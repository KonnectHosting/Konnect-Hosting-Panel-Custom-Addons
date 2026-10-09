#!/usr/bin/env php
<?php
declare(strict_types=1);

// This runner has no PHPUnit, Composer, Laravel, network, or database dependency.
require dirname(__DIR__) . '/bootstrap.php';
require __DIR__ . '/Support.php';

$suite = new \Konnect\AddonManager\Tests\Suite();
foreach (['CoreTest.php', 'LifecycleTest.php', 'BootstrapTest.php', 'SDKTest.php', 'NativeBuildIntegration.php'] as $file) require __DIR__ . '/' . $file;
try {
    exit($suite->run(array_slice($argv, 1)));
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(2);
}
