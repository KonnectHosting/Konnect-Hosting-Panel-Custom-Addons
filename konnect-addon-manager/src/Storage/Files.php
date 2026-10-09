<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Storage;

use RuntimeException;

/** Private filesystem primitives shared by the standalone worker and recovery CLI. */
final class Files
{
    public static function directory(string $path, int $mode = 0700): void
    {
        self::noLinks($path);
        if (!is_dir($path)) {
            $created = [];
            for ($part = $path; !is_dir($part) && $part !== '/' && $part !== '.'; $part = dirname($part)) {
                $created[] = $part;
            }
            if (!mkdir($path, $mode, true) && !is_dir($path)) {
                throw new RuntimeException("Cannot create directory: {$path}");
            }
            foreach ($created as $part) {
                if (!chmod($part, $mode)) {
                    throw new RuntimeException("Cannot set directory permissions: {$part}");
                }
            }
        }
    }

    public static function noLinks(string $path): void
    {
        for ($part = $path; $part !== '' && $part !== '/' && $part !== '.'; $part = dirname($part)) {
            if (is_link($part)) {
                throw new RuntimeException("Symbolic links are not supported in managed paths: {$part}");
            }
        }
    }

    public static function relative(string $path): string
    {
        if ($path === '' || str_contains($path, "\0") || str_contains($path, '\\') || str_starts_with($path, '/') || preg_match('/^[A-Za-z]:/', $path)) {
            throw new RuntimeException("Unsafe relative path: {$path}");
        }
        foreach (explode('/', $path) as $part) {
            if ($part === '' || $part === '.' || $part === '..' || preg_match('/[\x00-\x1f\x7f]/', $part)) {
                throw new RuntimeException("Unsafe relative path: {$path}");
            }
        }
        return $path;
    }

    public static function path(string $root, string $relative): string
    {
        $path = rtrim($root, '/') . '/' . self::relative($relative);
        self::noLinks($path);
        return $path;
    }

    public static function read(string $path): string
    {
        self::noLinks($path);
        $bytes = file_get_contents($path);
        if ($bytes === false) {
            throw new RuntimeException("Cannot read file: {$path}");
        }
        return $bytes;
    }

    public static function hash(string $path): ?string
    {
        self::noLinks($path);
        if (!file_exists($path)) {
            return null;
        }
        if (!is_file($path)) {
            throw new RuntimeException("Expected regular file: {$path}");
        }
        $hash = hash_file('sha256', $path);
        if ($hash === false) {
            throw new RuntimeException("Cannot hash file: {$path}");
        }
        return $hash;
    }

    public static function atomic(string $path, string $bytes, int $mode = 0600, ?string $temporary = null, ?callable $beforeRename = null): void
    {
        self::noLinks($path);
        self::directory(dirname($path));
        $temporary ??= dirname($path) . '/.konnect-' . bin2hex(random_bytes(12)) . '.tmp';
        if (dirname($temporary) !== dirname($path) || $temporary === $path) {
            throw new RuntimeException('Atomic temporary file must share its destination directory.');
        }
        self::noLinks($temporary);
        $handle = fopen($temporary, 'xb');
        if ($handle === false) {
            throw new RuntimeException("Cannot prepare atomic file: {$path}");
        }
        try {
            chmod($temporary, $mode);
            $offset = 0;
            while ($offset < strlen($bytes)) {
                $written = fwrite($handle, substr($bytes, $offset));
                if ($written === false || $written === 0) {
                    throw new RuntimeException("Cannot write atomic file: {$path}");
                }
                $offset += $written;
            }
            if (!fflush($handle) || (function_exists('fsync') && !fsync($handle))) {
                throw new RuntimeException("Cannot flush atomic file: {$path}");
            }
            fclose($handle);
            $handle = null;
            if ($beforeRename !== null) {
                $beforeRename();
            }
            if (!rename($temporary, $path)) {
                throw new RuntimeException("Cannot activate atomic file: {$path}");
            }
            self::syncDirectory(dirname($path));
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
            if (is_file($temporary)) {
                unlink($temporary);
            }
        }
    }

    public static function syncDirectory(string $directory): void
    {
        if (function_exists('fsync')) {
            $handle = @fopen($directory, 'r');
            if (is_resource($handle)) {
                @fsync($handle);
                fclose($handle);
            }
        }
    }

    public static function json(string $path, ?array $default = null): array
    {
        if (!is_file($path) && $default !== null) {
            return $default;
        }
        try {
            $value = json_decode(self::read($path), true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException $error) {
            throw new RuntimeException("Invalid state JSON: {$path}", 0, $error);
        }
        if (!is_array($value)) {
            throw new RuntimeException("Invalid state document: {$path}");
        }
        return $value;
    }

    public static function writeJson(string $path, array $value): void
    {
        self::atomic($path, json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n");
    }

    /** Inventory includes every regular file; exclusions apply to whole subtrees. */
    public static function inventory(string $root, array $exclude = [], bool $filterSensitive = false): array
    {
        self::noLinks($root);
        $result = [];
        $walk = function (string $directory, string $prefix) use (&$walk, &$result, $exclude, $filterSensitive): void {
            $entries = scandir($directory);
            if ($entries === false) {
                throw new RuntimeException("Cannot scan directory: {$directory}");
            }
            foreach ($entries as $entry) {
                if ($entry === '.' || $entry === '..') {
                    continue;
                }
                $relative = $prefix . $entry;
                foreach ($exclude as $excluded) {
                    if ($relative === $excluded || str_starts_with($relative, $excluded . '/')) {
                        continue 2;
                    }
                }
                if ($filterSensitive && (preg_match('/^(?:\.env(?:\.|$)|\.aws$|\.ssh$|\.git$)/', $entry) || preg_match('/\.(?:pem|key|p12|pfx)$/i', $entry))) {
                    continue;
                }
                $path = $directory . '/' . $entry;
                self::noLinks($path);
                if (is_dir($path)) {
                    $walk($path, $relative . '/');
                } elseif (is_file($path)) {
                    $result[$relative] = self::hash($path);
                } else {
                    throw new RuntimeException("Unsupported file type in managed source: {$relative}");
                }
            }
        };
        $walk(rtrim($root, '/'), '');
        ksort($result, SORT_STRING);
        return $result;
    }

    public static function copyInventory(string $from, string $to, array $inventory): void
    {
        self::directory($to);
        foreach ($inventory as $relative => $digest) {
            $source = self::path($from, $relative);
            $bytes = self::read($source);
            if (!hash_equals($digest, hash('sha256', $bytes))) {
                throw new RuntimeException("Source changed while snapshotting: {$relative}");
            }
            self::atomic(self::path($to, $relative), $bytes, fileperms($source) & 0777);
        }
    }

    /** Return a held lock handle; caller must close it. */
    public static function lock(string $path, bool $blocking = true)
    {
        self::noLinks($path);
        self::directory(dirname($path));
        $handle = fopen($path, 'c');
        if ($handle === false) {
            throw new RuntimeException('Cannot open manager deployment lock.');
        }
        chmod($path, 0600);
        if (!flock($handle, LOCK_EX | ($blocking ? 0 : LOCK_NB))) {
            fclose($handle);
            return null;
        }
        return $handle;
    }
}
