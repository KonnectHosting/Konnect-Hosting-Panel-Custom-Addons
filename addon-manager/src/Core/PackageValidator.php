<?php
declare(strict_types=1);

namespace AddonManager\Core;

use FilesystemIterator;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;

final class PackageValidator
{
    public static function validate(string $packageRoot): array
    {
        $root = Paths::realDirectory($packageRoot);
        $manifestPath = Paths::destination($root, 'manifest.json');
        if (!is_file($manifestPath) || filesize($manifestPath) > 1048576) { throw new RuntimeException('Missing or oversized manifest.json.'); }
        $manifest = ManifestValidator::validate(self::json($manifestPath));
        $declared = ['manifest.json'=>null];
        foreach ($manifest['files'] as $file) { self::declare($declared, $file['source'], $file['sha256']); }
        foreach ($manifest['patches'] as $patch) {
            self::declare($declared, $patch['find'], $patch['beforeSha256']); self::declare($declared, $patch['replace'], $patch['afterSha256']);
            foreach (['find','replace'] as $kind) {
                $path = Paths::destination($root, $patch[$kind]);
                if (!is_file($path) || filesize($path) > 1048576) { throw new RuntimeException('Missing or oversized patch fragment.'); }
                $fragment = file_get_contents($path);
                if ($fragment === false || preg_match('//u', $fragment) !== 1 || str_contains($fragment, "\0") || ($kind === 'find' && $fragment === '')) { throw new RuntimeException('Patch fragments must be UTF-8; find must not be empty.'); }
            }
        }
        foreach ($manifest['database']['migrations'] as $migration) {
            self::declare($declared, $migration['source'], $migration['sha256']);
            $path = Paths::destination($root, $migration['source']);
            if (!is_file($path) || filesize($path) > 1048576) { throw new RuntimeException('Missing or oversized migration JSON.'); }
            ManifestValidator::validateMigration(self::json($path), $manifest['id']);
        }
        $seen = []; $bytes = 0; $count = 0;
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
        foreach ($iterator as $entry) {
            if (++$count > 10000 || $entry->isLink()) { throw new RuntimeException('Package contains symbolic links or too many entries.'); }
            $relative = substr($entry->getPathname(), strlen($root) + 1); Paths::assertRelative($relative);
            if (Paths::isProtected($relative)) { throw new RuntimeException('Protected package content: ' . $relative); }
            $folded = strtolower($relative);
            if (isset($seen[$folded])) { throw new RuntimeException('Package has a case collision.'); } $seen[$folded] = true;
            if ($entry->isDir()) { continue; }
            if (!$entry->isFile() || (($bytes += $entry->getSize()) > 268435456)) { throw new RuntimeException('Package contains special files or excessive data.'); }
            $stat = lstat($entry->getPathname());
            if ($stat === false || $stat['nlink'] !== 1) { throw new RuntimeException('Package hard links are forbidden.'); }
            if (!array_key_exists($relative, $declared)) {
                if (!in_array($relative, ['README','README.md','README.txt','LICENSE','LICENSE.md','LICENSE.txt'], true) || $entry->getSize() > 1048576) { throw new RuntimeException('Undeclared package file: ' . $relative); }
                continue;
            }
            if ($declared[$relative] !== null && !hash_equals($declared[$relative], (string) hash_file('sha256', $entry->getPathname()))) { throw new RuntimeException('Checksum mismatch: ' . $relative); }
            unset($declared[$relative]);
        }
        if ($declared !== []) { throw new RuntimeException('Missing declared package file: ' . array_key_first($declared)); }
        return $manifest;
    }

    private static function declare(array &$declared, string $path, string $hash): void
    {
        if ($path === 'manifest.json') { throw new RuntimeException('manifest.json cannot be payload.'); }
        if (array_key_exists($path, $declared) && $declared[$path] !== $hash) { throw new RuntimeException('Conflicting source checksum: ' . $path); }
        $declared[$path] = $hash;
    }

    public static function json(string $path): array
    {
        $bytes = file_get_contents($path);
        if ($bytes === false) { throw new RuntimeException('Unable to read JSON document.'); }
        return JsonDocument::decode($bytes);
    }
}
