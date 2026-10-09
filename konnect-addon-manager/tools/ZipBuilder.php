<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Tools;

use RuntimeException;
use ZipArchive;

/** Reproducible ZIP writer shared by addon and manager release tooling. */
final class ZipBuilder
{
    /** @param array<string,string> $entries Archive name => local file path. */
    public static function write(array $entries, string $output): string
    {
        if ($output === '' || preg_match('/[\x00\r\n]/', $output)) {
            throw new RuntimeException('Invalid archive output path.');
        }
        if (!class_exists(ZipArchive::class)) {
            throw new RuntimeException('PHP ext-zip is required to create release archives.');
        }
        if (file_exists($output) || is_link($output)) {
            throw new RuntimeException('Output already exists: ' . $output);
        }
        $parent = realpath(dirname($output));
        if ($parent === false || !is_dir($parent) || !is_writable($parent)) {
            throw new RuntimeException('Output parent directory must exist and be writable.');
        }
        ksort($entries, SORT_STRING);
        $temporary = tempnam($parent, '.konnect-zip-');
        if ($temporary === false) {
            throw new RuntimeException('Could not create a temporary archive.');
        }
        $zip = new ZipArchive();
        $opened = false;
        try {
            if ($zip->open($temporary, ZipArchive::OVERWRITE) !== true) {
                throw new RuntimeException('Could not open the archive for writing.');
            }
            $opened = true;
            foreach ($entries as $name => $source) {
                if (str_contains($name, '\\') || str_starts_with($name, '/') || preg_match('~(^|/)\.{1,2}(/|$)~', $name)) {
                    throw new RuntimeException('Unsafe archive entry: ' . $name);
                }
                if (is_link($source) || !is_file($source)) {
                    throw new RuntimeException('Archive inputs must be regular files: ' . $source);
                }
                $bytes = file_get_contents($source);
                if ($bytes === false || !$zip->addFromString($name, $bytes)) {
                    throw new RuntimeException('Could not archive: ' . $name);
                }
                // DOS timestamps are local-time based: a fixed TZ makes bytes repeatable.
                if (!$zip->setMtimeName($name, 315532800)
                    || !$zip->setCompressionName($name, ZipArchive::CM_DEFLATE, 9)
                    || !$zip->setExternalAttributesName($name, ZipArchive::OPSYS_UNIX, 0100644 << 16)) {
                    throw new RuntimeException('Could not normalize archive metadata: ' . $name);
                }
            }
            if (!$zip->close()) {
                throw new RuntimeException('Could not finish the archive.');
            }
            $opened = false;
            // A hard link publishes without overwriting an output created concurrently.
            if (!link($temporary, $output)) {
                throw new RuntimeException('Could not save the archive.');
            }
            unlink($temporary);
            $digest = hash_file('sha256', $output);
            if ($digest === false) {
                throw new RuntimeException('Could not hash the archive.');
            }
            return $digest;
        } catch (\Throwable $error) {
            if ($opened) {
                @$zip->close();
            }
            @unlink($temporary);
            throw $error;
        }
    }

    public static function writeChecksum(string $output, string $digest): void
    {
        $path = $output . '.sha256';
        $handle = @fopen($path, 'xb');
        if ($handle === false) {
            throw new RuntimeException('Checksum output already exists or cannot be created: ' . $path);
        }
        try {
            $bytes = $digest . '  ' . basename($output) . "\n";
            $offset = 0;
            while ($offset < strlen($bytes)) {
                $written = fwrite($handle, substr($bytes, $offset));
                if ($written === false || $written === 0) {
                    throw new RuntimeException('Could not write checksum file.');
                }
                $offset += $written;
            }
        } catch (\Throwable $error) {
            @unlink($path);
            throw $error;
        } finally {
            fclose($handle);
        }
    }
}
