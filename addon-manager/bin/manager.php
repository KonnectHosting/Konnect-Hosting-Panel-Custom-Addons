#!/usr/bin/env php
<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use AddonManager\Laravel\HostAdapter;
use AddonManager\Lifecycle\Manager;
use AddonManager\Laravel\WorkerControl;
use AddonManager\Storage\Files;

/** Options may precede or follow the command; no shell interpretation is involved. */
function addonManagerArguments(array $arguments): array
{
    $options = [];
    $command = null;
    $flags = ['once', 'cascade', 'help'];
    $values = ['panel-root', 'operation', 'url', 'addon-id', 'package-root', 'request-id', 'candidate-registry'];
    for ($index = 0; $index < count($arguments); ++$index) {
        $argument = $arguments[$index];
        if (!str_starts_with($argument, '--')) {
            if ($command !== null) {
                throw new RuntimeException('Unexpected positional argument: ' . $argument);
            }
            $command = $argument;
            continue;
        }
        $parts = explode('=', substr($argument, 2), 2);
        $key = $parts[0];
        if (array_key_exists($key, $options)) {
            throw new RuntimeException('Duplicate option: --' . $key);
        }
        if (in_array($key, $flags, true) && count($parts) === 1) {
            $options[$key] = true;
        } elseif (in_array($key, $values, true)) {
            $value = $parts[1] ?? ($arguments[++$index] ?? null);
            if (!is_string($value) || $value === '' || str_starts_with($value, '--')) {
                throw new RuntimeException('Option requires a value: --' . $key);
            }
            $options[$key] = $value;
        } else {
            throw new RuntimeException('Unknown option: --' . $key);
        }
    }
    return [$command ?? 'doctor', $options];
}

function addonManagerPrint(array $value): void
{
    fwrite(STDOUT, json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n");
}

/** Reject unused options before booting or changing the Panel. */
function addonManagerValidateCommand(string $command, array $options): void
{
    $supported = [
        'doctor' => [],
        'worker' => ['once'],
        'recover' => ['operation'],
        'readiness' => ['candidate-registry'],
        'install' => ['url', 'package-root', 'request-id'],
        'update' => ['addon-id', 'url', 'package-root', 'request-id'],
        'enable' => ['addon-id', 'request-id'],
        'disable' => ['addon-id', 'cascade', 'request-id'],
        'delete' => ['addon-id', 'cascade', 'request-id'],
        'operation' => ['operation'],
    ];
    if (!array_key_exists($command, $supported)) {
        throw new RuntimeException('Unknown command. Use --help for supported commands.');
    }
    $unused = array_diff(array_keys($options), ['panel-root', 'help', ...$supported[$command]]);
    if ($unused !== []) {
        throw new RuntimeException('Unsupported option for ' . $command . ': --' . implode(', --', $unused));
    }
    if ($command === 'operation' && !isset($options['operation'])) {
        throw new RuntimeException('--operation is required.');
    }
    if (in_array($command, ['update', 'enable', 'disable', 'delete'], true) && !isset($options['addon-id'])) {
        throw new RuntimeException('--addon-id is required.');
    }
    if (in_array($command, ['install', 'update'], true) && (int) isset($options['url']) + (int) isset($options['package-root']) !== 1) {
        throw new RuntimeException('Provide exactly one --url or --package-root.');
    }
}

function addonManagerHeartbeat(string $stateRoot, string $status): void
{
    $file = $stateRoot . '/worker-heartbeat.json';
    $temporary = $file . '.tmp-' . bin2hex(random_bytes(6));
    $bytes = json_encode(['pid' => getmypid(), 'at' => time(), 'status' => $status, 'uid' => function_exists('posix_geteuid') ? posix_geteuid() : null], JSON_THROW_ON_ERROR);
    if (file_put_contents($temporary, $bytes, LOCK_EX) !== strlen($bytes) || !chmod($temporary, 0600) || !rename($temporary, $file)) {
        throw new RuntimeException('Cannot persist management worker heartbeat.');
    }
}

try {
    [$command, $options] = addonManagerArguments(array_slice($argv, 1));
    if (isset($options['help'])) {
        fwrite(STDOUT, "Usage: php addon-manager/bin/manager.php <command> --panel-root=/path\nCommands:\n  doctor                   Host and deployment diagnostics\n  worker [--once]          Dedicated durable-operation worker\n  recover [--operation=id] Standalone file recovery; no Panel/Laravel boot\n  readiness                Independent host boot/database/route probe\n  install --url=URL         Queue GitHub addon installation\n  update --addon-id=ID --url=URL\n  enable --addon-id=ID\n  disable|delete --addon-id=ID [--cascade]\n  operation --operation=ID\nLocal CLI installs and updates may use --package-root=/path instead of --url.\nLifecycle commands accept --request-id=ID to safely retry the same request.\n");
        exit(0);
    }
    addonManagerValidateCommand($command, $options);
    $root = realpath($options['panel-root'] ?? dirname(__DIR__, 2));
    if ($root === false || !is_dir($root)) {
        throw new RuntimeException('Panel root must be a real directory.');
    }
    $stateRoot = $root . '/storage/app/addon-manager';
    if ($command === 'recover') {
        // This branch MUST remain before Composer and Laravel loading.
        $settingsFile = $stateRoot . '/host.json';
        $settings = is_file($settingsFile) ? Files::json($settingsFile) : [];
        $manager = new Manager($root, $stateRoot, ['beforeRollback' => static function (array $operation) use ($root, $stateRoot, $settings): array {
            $ownerFile = $stateRoot . '/maintenance-owner.json';
            $owner = is_file($ownerFile) ? Files::json($ownerFile) : null;
            if ($owner === null || ($owner['operationId'] ?? null) !== $operation['id']) {
                throw new RuntimeException('Standalone recovery cannot prove ownership of the affected services. Keep maintenance and establish scoped worker-control ownership before restoring active files.');
            }
            $downFile = $root . '/storage/framework/down';
            if (!is_file($downFile)) {
                Files::atomic($downFile, json_encode(['status' => 503, 'retry' => 15, 'addonManagerOperationId' => $operation['id']], JSON_THROW_ON_ERROR), 0644);
            }
            return (new WorkerControl($settings['workerControl'] ?? []))->stop();
        }]);
        $result = $manager->recover($options['operation'] ?? null);
        $result['nextStep'] = 'Files were assessed without booting Panel. If maintenance remains, review database journals, then run doctor and restore the configured supervised services before leaving maintenance.';
        addonManagerPrint($result);
        exit(($result['ok'] ?? true) ? 0 : 1);
    }
    if ($command === 'readiness') {
        define('ADDON_MANAGER_READINESS', true);
        if (isset($options['candidate-registry'])) {
            $candidate = realpath($options['candidate-registry']);
            if ($candidate === false || $candidate !== realpath($stateRoot . '/candidate-registry.json')) {
                throw new RuntimeException('Readiness may only use the manager-owned candidate registry.');
            }
            define('ADDON_MANAGER_CANDIDATE_REGISTRY', $candidate);
        }
        $host = HostAdapter::boot($root);
        $app = $host->application();
        $app['db']->connection()->select('SELECT 1');
        $route = $app['router']->getRoutes()->getByName('admin.addon-manager.index');
        if ($route === null) {
            throw new RuntimeException('Manager admin route is missing.');
        }
        $required = ['web', 'auth.session', \Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication::class, \Pterodactyl\Http\Middleware\AdminAuthenticate::class];
        if (array_diff($required, $route->gatherMiddleware()) !== []) {
            throw new RuntimeException('Manager admin route is missing required authorization middleware.');
        }
        addonManagerPrint(['ready' => true, 'checks' => ['fresh-panel-boot', 'database', 'admin-session', 'two-factor', 'root-admin', 'web-csrf']]);
        exit(0);
    }
    if (isset($options['candidate-registry'])) {
        throw new RuntimeException('Candidate registry is only supported by the internal readiness command.');
    }
    if ($command === 'worker') {
        define('ADDON_MANAGER_WORKER', true);
    }
    $host = HostAdapter::boot($root);
    $manager = $host->manager();
    if ($command === 'doctor') {
        $report = ['host' => $host->doctor(), 'manager' => $manager->doctor()];
        addonManagerPrint($report);
        exit(($report['host']['ready'] ?? false) && ($report['manager']['ok'] ?? false) && ($report['manager']['runner']['ready'] ?? false) ? 0 : 1);
    }
    if ($command === 'operation') {
        if (!isset($options['operation'])) {
            throw new RuntimeException('--operation is required.');
        }
        addonManagerPrint($manager->operation($options['operation']));
        exit(0);
    }
    if (in_array($command, ['install', 'update', 'enable', 'disable', 'delete'], true)) {
        $arguments = [];
        foreach (['url' => 'url', 'addon-id' => 'addonId', 'package-root' => 'packageRoot', 'cascade' => 'cascade'] as $option => $field) {
            if (isset($options[$option])) {
                $arguments[$field] = $options[$option];
            }
        }
        addonManagerPrint($manager->enqueue($command, $arguments, 'cli', $options['request-id'] ?? null));
        exit(0);
    }
    if ($command !== 'worker') {
        throw new RuntimeException('Unknown command. Use --help for supported commands.');
    }
    if (!is_file($stateRoot . '/registry.json')) {
        throw new RuntimeException('Run the initial manager installer before starting its worker.');
    }
    $lock = fopen($stateRoot . '/management-worker.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        throw new RuntimeException('A dedicated management worker already holds its lock.');
    }
    $stop = false;
    if (function_exists('pcntl_async_signals')) {
        pcntl_async_signals(true);
        pcntl_signal(SIGTERM, static function () use (&$stop): void { $stop = true; });
        pcntl_signal(SIGINT, static function () use (&$stop): void { $stop = true; });
    }
    try {
        do {
            addonManagerHeartbeat($stateRoot, 'working');
            $operation = $manager->workOnce();
            addonManagerHeartbeat($stateRoot, 'idle');
            if ($operation !== null) {
                // Diagnostics remain in durable operation state, not a web request.
                addonManagerPrint(['operationId' => $operation['id'], 'status' => $operation['status']]);
            }
            if (isset($options['once']) || $stop) {
                break;
            }
            for ($tick = 0; $tick < 10 && !$stop; ++$tick) {
                usleep(500000);
            }
        } while (!$stop);
    } finally {
        addonManagerHeartbeat($stateRoot, 'stopped');
        flock($lock, LOCK_UN);
        fclose($lock);
    }
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode(['message' => $e->getMessage()], JSON_UNESCAPED_SLASHES) . "\n");
    exit(1);
}
