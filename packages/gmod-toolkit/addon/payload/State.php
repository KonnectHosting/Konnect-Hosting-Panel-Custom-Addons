<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use RuntimeException;

final class State
{
    public function __construct(private ?string $root = null)
    {
        $this->root ??= storage_path('app/gmod-toolkit');
        for ($part = $this->root; $part !== '/' && $part !== '.'; $part = dirname($part)) {
            if (is_link($part)) { throw new RuntimeException('Unsafe toolkit state directory.'); }
        }
        if (!is_dir($this->root) && !mkdir($this->root, 0700, true) && !is_dir($this->root)) {
            throw new RuntimeException('Cannot create private toolkit storage.');
        }
        chmod($this->root, 0700);
        $actual = realpath($this->root);
        foreach ([public_path(), storage_path('app/public')] as $public) {
            if ($actual === $public || str_starts_with($actual . '/', rtrim($public, '/') . '/')) {
                throw new RuntimeException('Toolkit state must be outside public paths.');
            }
        }
    }

    private function path(string $key): string
    {
        if (!preg_match('/^[a-z0-9-]{1,180}$/D', $key)) { throw new RuntimeException('Invalid state key.'); }
        $path = $this->root . '/' . $key . '.json';
        if (is_link($path)) { throw new RuntimeException('Unsafe state file.'); }
        return $path;
    }

    public function read(string $key, array $fallback = []): array
    {
        $path = $this->path($key);
        return is_file($path) ? json_decode((string) file_get_contents($path), true, 64, JSON_THROW_ON_ERROR) : $fallback;
    }

    public function write(string $key, array $value): void
    {
        $path = $this->path($key);
        $temp = $this->root . '/tmp-' . bin2hex(random_bytes(16));
        $fd = fopen($temp, 'x');
        if (!$fd) { throw new RuntimeException('Cannot save toolkit state.'); }
        try {
            chmod($temp, 0600);
            $bytes = json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
            if (fwrite($fd, $bytes) !== strlen($bytes) || !fflush($fd)) { throw new RuntimeException('Incomplete state write.'); }
        } finally { fclose($fd); }
        if (!rename($temp, $path)) { @unlink($temp); throw new RuntimeException('Cannot commit toolkit state.'); }
    }

    public function locked(string $key, callable $callback): mixed
    {
        $path = $this->path('lock-' . $key);
        $fd = fopen($path, 'c');
        if (!$fd) { throw new RuntimeException('Cannot lock toolkit state.'); }
        chmod($path, 0600);
        try {
            if (!flock($fd, LOCK_EX | LOCK_NB)) { abort(409, 'Another toolkit operation is in progress.'); }
            return $callback();
        } finally { flock($fd, LOCK_UN); fclose($fd); }
    }

    public function backups(string $uuid): array
    {
        return $this->read('backups-' . $uuid)['entries'] ?? [];
    }

    public function remove(string $key): void
    {
        $path = $this->path($key);
        if (is_file($path) && !unlink($path)) { throw new RuntimeException('Cannot remove private state.'); }
    }

    public function keys(string $prefix, int $limit = 10000): array
    {
        if ($limit < 1 || $limit > 50001) { throw new RuntimeException('Invalid state listing limit.'); }
        if (!preg_match('/^[a-z0-9-]+$/D', $prefix)) { throw new RuntimeException('Invalid state prefix.'); }
        $keys = [];
        foreach (new \DirectoryIterator($this->root) as $entry) {
            $name = $entry->getFilename();
            if ($entry->isFile() && !$entry->isLink() && str_starts_with($name, $prefix) && str_ends_with($name, '.json')) {
                $keys[] = substr($name, 0, -5);
                if (count($keys) >= $limit) { break; }
            }
        }
        return $keys;
    }

    public function directory(string $key): string
    {
        $path = substr($this->path($key), 0, -5);
        if (is_link($path) || (file_exists($path) && !is_dir($path))) { throw new RuntimeException('Unsafe snapshot directory.'); }
        if (!is_dir($path) && !mkdir($path, 0700)) { throw new RuntimeException('Cannot create private snapshot.'); }
        chmod($path, 0700);
        return $path;
    }

    public function object(string $key, string $name): string
    {
        if (!preg_match('/^[a-f0-9]{64}(?:\.bz2|\.part)?$/D', $name)) { throw new RuntimeException('Invalid snapshot object.'); }
        $path = $this->directory($key) . '/' . $name;
        if (is_link($path)) { throw new RuntimeException('Unsafe snapshot object.'); }
        return $path;
    }

    public function removeDirectory(string $key): void
    {
        $path = $this->directory($key);
        foreach (new \DirectoryIterator($path) as $entry) {
            if ($entry->isDot()) { continue; }
            if (!$entry->isFile() || $entry->isLink()) { throw new RuntimeException('Unexpected snapshot entry.'); }
            unlink($entry->getPathname());
        }
        rmdir($path);
    }
}
