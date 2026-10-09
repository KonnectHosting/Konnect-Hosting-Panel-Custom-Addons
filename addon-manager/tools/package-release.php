#!/usr/bin/env php
<?php

declare(strict_types=1);

require __DIR__ . '/ZipBuilder.php';

use AddonManager\Tools\ZipBuilder;

date_default_timezone_set('UTC');

try {
    $root = realpath(dirname(__DIR__));
    $output = null;
    foreach (array_slice($argv, 1) as $argument) {
        if ($argument === '--help') {
            fwrite(STDOUT, "Usage: php tools/package-release.php --output=/path/addon-manager.zip\nCreates a deterministic manager-only ZIP and SHA-256 sidecar.\n");
            exit(0);
        }
        if (str_starts_with($argument, '--output=') && $output === null) {
            $output = substr($argument, 9);
        } else {
            throw new RuntimeException('Unknown or duplicate argument: ' . $argument);
        }
    }
    if ($output === null || $output === '') {
        throw new RuntimeException('Provide --output=/path/addon-manager.zip.');
    }
    $outputParent = realpath(dirname($output));
    if ($outputParent === $root || ($outputParent !== false && str_starts_with($outputParent . '/', $root . '/'))) {
        throw new RuntimeException('Release output must be outside addon-manager/.');
    }
    if (file_exists($output . '.sha256') || is_link($output . '.sha256')) {
        throw new RuntimeException('Checksum output already exists.');
    }
    $rootFiles = ['install.php', 'bootstrap.php', 'README.md'];
    $directories = ['bin', 'src', 'routes', 'resources', 'public', 'schemas', 'adapters', 'migrations', 'sdk', 'docs', 'tools'];
    $excludedDirectories = ['tests', 'storage', 'state', 'node_modules', 'vendor', 'cache', 'logs', 'tmp', 'temp', 'backups', 'journals', 'staging'];
    $entries = [];
    foreach ($rootFiles as $file) {
        if (!is_file($root . '/' . $file) || is_link($root . '/' . $file)) {
            throw new RuntimeException('Required manager release file is missing: ' . $file);
        }
        $entries['addon-manager/' . $file] = $root . '/' . $file;
    }
    foreach ($directories as $directory) {
        if (!is_dir($root . '/' . $directory) || is_link($root . '/' . $directory)) {
            throw new RuntimeException('Required manager release directory is missing or linked: ' . $directory);
        }
        $filter = new RecursiveCallbackFilterIterator(
            new RecursiveDirectoryIterator($root . '/' . $directory, FilesystemIterator::SKIP_DOTS),
            static function (SplFileInfo $file) use ($root, $excludedDirectories): bool {
                $relative = substr($file->getPathname(), strlen($root) + 1);
                $parts = explode('/', str_replace(DIRECTORY_SEPARATOR, '/', $relative));
                if (array_intersect($parts, $excludedDirectories)
                    || array_filter($parts, static fn (string $part): bool => str_starts_with($part, '.'))) {
                    return false;
                }
                if ($file->isLink()) {
                    throw new RuntimeException('Release contains a symlink: ' . $relative);
                }
                return $file->isDir() || !preg_match('/\.(?:zip|sha256|log|sqlite|sqlite3|bak|tmp|lock)$/i', $file->getFilename());
            }
        );
        foreach (new RecursiveIteratorIterator($filter) as $file) {
            $relative = substr($file->getPathname(), strlen($root) + 1);
            if (!$file->isFile()) {
                throw new RuntimeException('Release contains a non-regular entry: ' . $relative);
            }
            $entries['addon-manager/' . str_replace(DIRECTORY_SEPARATOR, '/', $relative)] = $file->getPathname();
        }
    }
    $digest = ZipBuilder::write($entries, $output);
    try {
        ZipBuilder::writeChecksum($output, $digest);
    } catch (Throwable $error) {
        @unlink($output);
        throw $error;
    }
    fwrite(STDOUT, json_encode(['path' => $output, 'sha256' => $digest, 'files' => count($entries)], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . "\n");
} catch (Throwable $error) {
    fwrite(STDERR, 'Manager release: ' . $error->getMessage() . "\n");
    exit(1);
}
