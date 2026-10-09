<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Sdk;

use Konnect\AddonManager\Core\ArchiveExtractor;
use Konnect\AddonManager\Core\PackageValidator;
use Konnect\AddonManager\Tools\ZipBuilder;
use RuntimeException;

final class Exporter
{
    public function validate(string $packageRoot): array
    {
        return (new PackageValidator())->validate($packageRoot);
    }

    /** @return array{path:string,sha256:string,id:string,version:string} */
    public function export(string $packageRoot, string $output): array
    {
        $root = realpath($packageRoot);
        if ($root === false || !is_dir($root)) {
            throw new RuntimeException('Package directory does not exist.');
        }
        $manifest = $this->validate($root);
        $entries = self::files($root);
        $outputParent = realpath(dirname($output));
        if ($outputParent === $root || ($outputParent !== false && str_starts_with($outputParent . '/', $root . '/'))) {
            throw new RuntimeException('Write the export outside the package directory.');
        }
        $sha256 = ZipBuilder::write($entries, $output);
        $scratch = sys_get_temp_dir() . '/konnect-export-' . bin2hex(random_bytes(12));
        try {
            // Re-use the installer's archive safety checks, then verify every byte again.
            $extracted = (new ArchiveExtractor())->extract($output, $scratch);
            $roundTrip = $this->validate($extracted);
            if ($manifest !== $roundTrip) {
                throw new RuntimeException('Exported package manifest differs after round-trip validation.');
            }
        } catch (\Throwable $error) {
            @unlink($output);
            throw $error;
        } finally {
            self::removeTree($scratch);
        }
        return ['path' => $output, 'sha256' => $sha256, 'id' => $manifest['id'], 'version' => $manifest['version']];
    }

    /** @return array<string,string> */
    public static function files(string $root): array
    {
        $files = [];
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if ($file->isLink() || !$file->isFile()) {
                throw new RuntimeException('Only regular files may be exported: ' . $file->getPathname());
            }
            $relative = substr($file->getPathname(), strlen($root) + 1);
            $files[str_replace(DIRECTORY_SEPARATOR, '/', $relative)] = $file->getPathname();
        }
        ksort($files, SORT_STRING);
        return $files;
    }

    private static function removeTree(string $root): void
    {
        if (!is_dir($root) || is_link($root)) {
            return;
        }
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator($root, \FilesystemIterator::SKIP_DOTS),
            \RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($iterator as $file) {
            if ($file->isDir() && !$file->isLink()) {
                @rmdir($file->getPathname());
            } else {
                @unlink($file->getPathname());
            }
        }
        @rmdir($root);
    }
}
