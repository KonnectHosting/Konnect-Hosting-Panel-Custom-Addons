#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

use Konnect\AddonManager\Installer\BootstrapInstaller;
use Konnect\AddonManager\Installer\Installer;

try {
    $options = getopt('', ['panel-root:', 'dry-run', 'config:', 'recover-bootstrap', 'help']);
    if (isset($options['help'])) {
        fwrite(STDOUT, "Usage: php konnect-addon-manager/install.php --panel-root=/path/to/panel [--dry-run] [--config=/path/to/host-settings.json]\n       php konnect-addon-manager/install.php --panel-root=/path/to/panel --recover-bootstrap\n");
        exit(0);
    }
    $root = realpath((string) ($options['panel-root'] ?? dirname(__DIR__)));
    if ($root === false || !is_dir($root)) {
        throw new RuntimeException('The selected Panel root is not a real directory.');
    }
    if (isset($options['recover-bootstrap'])) {
        $result = (new BootstrapInstaller($root))->restore();
    } else {
        $configuration = isset($options['config']) ? json_decode((string) file_get_contents($options['config']), true, 64, JSON_THROW_ON_ERROR) : [];
        if (!is_array($configuration)) {
            throw new RuntimeException('Host configuration must be a JSON object.');
        }
        $result = (new Installer($root))->run(isset($options['dry-run']), $configuration);
    }
    fwrite(STDOUT, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n");
    exit(($result['success'] ?? true) ? 0 : 1);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode(['message' => $e->getMessage()], JSON_UNESCAPED_SLASHES) . "\n");
    exit(1);
}
