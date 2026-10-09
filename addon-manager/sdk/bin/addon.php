#!/usr/bin/env php
<?php

declare(strict_types=1);

require dirname(__DIR__, 2) . '/bootstrap.php';
require dirname(__DIR__, 2) . '/tools/ZipBuilder.php';
require dirname(__DIR__) . '/src/Exporter.php';

use AddonManager\Sdk\Exporter;
use AddonManager\Tools\ZipBuilder;

date_default_timezone_set('UTC');

try {
    $command = $argv[1] ?? 'help';
    if ($command === 'help' || $command === '--help') {
        fwrite(STDOUT, "Usage:\n  php sdk/bin/addon.php validate PACKAGE_DIRECTORY\n  php sdk/bin/addon.php export PACKAGE_DIRECTORY --output=/path/addon.zip\n\nValidation checks the strict manifest and all declared package bytes. Export\nnever refreshes checksums. Generate an archive outside the package directory.\n");
        exit(0);
    }
    if (!in_array($command, ['validate', 'export'], true) || !isset($argv[2])) {
        throw new RuntimeException('Expected validate or export followed by a package directory; use --help.');
    }
    $output = null;
    foreach (array_slice($argv, 3) as $argument) {
        if ($command === 'export' && str_starts_with($argument, '--output=') && $output === null) {
            $output = substr($argument, 9);
        } else {
            throw new RuntimeException('Unknown or duplicate argument: ' . $argument);
        }
    }
    $exporter = new Exporter();
    if ($command === 'validate') {
        $manifest = $exporter->validate($argv[2]);
        fwrite(STDOUT, json_encode(['valid' => true, 'id' => $manifest['id'], 'version' => $manifest['version']], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . "\n");
    } else {
        if ($output === null || $output === '') {
            throw new RuntimeException('Export requires --output=/path/addon.zip.');
        }
        $checksum = $output . '.sha256';
        if (file_exists($checksum) || is_link($checksum)) {
            throw new RuntimeException('Checksum output already exists: ' . $checksum);
        }
        $result = $exporter->export($argv[2], $output);
        try {
            ZipBuilder::writeChecksum($output, $result['sha256']);
        } catch (Throwable $error) {
            @unlink($output);
            throw $error;
        }
        fwrite(STDOUT, json_encode($result, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . "\n");
    }
} catch (Throwable $error) {
    fwrite(STDERR, 'Addon export: ' . $error->getMessage() . "\n");
    exit(1);
}
