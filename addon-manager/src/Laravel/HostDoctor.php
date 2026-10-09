<?php

declare(strict_types=1);

namespace AddonManager\Laravel;

use AddonManager\Runner\IsolatedRunner;
use Throwable;

final class HostDoctor
{
    public function __construct(private readonly object $app, private readonly array $settings = [])
    {
    }

    public function run(): array
    {
        $checks = [];
        $this->check($checks, 'php', PHP_VERSION_ID >= 80200, 'PHP 8.2 or newer is required. Running ' . PHP_VERSION . '.');
        foreach (['json', 'mbstring', 'pdo', 'pdo_mysql', 'zip', 'openssl', 'fileinfo', 'posix'] as $extension) {
            $this->check($checks, 'extension:' . $extension, extension_loaded($extension), 'Required PHP extension: ' . $extension . '.');
        }
        foreach (['bootstrap/cache', 'storage', 'public', 'bootstrap/app.php', 'resources/views/layouts/admin.blade.php'] as $relative) {
            $path = $this->app->basePath($relative);
            $this->check($checks, 'writable:' . $relative, file_exists($path) && is_writable($path), 'Panel worker user must be able to write ' . $relative . '.');
        }
        $stateRoot = $this->app->storagePath('app/addon-manager');
        $free = disk_free_space($this->app->storagePath());
        $minimum = max(268435456, $this->sourceBytes() * 3);
        $this->check($checks, 'disk', $free !== false && $free >= $minimum, 'At least ' . $minimum . ' bytes are needed for baseline, staging, and rollback; available ' . ($free === false ? 'unknown' : (string) (int) $free) . '.');
        try {
            $this->app['db']->connection()->select('SELECT 1');
            $this->check($checks, 'database', true, 'Panel database connection succeeded.');
        } catch (Throwable $e) {
            $this->check($checks, 'database', false, 'Panel database connection failed (' . get_class($e) . '). Check existing Panel database settings.');
        }
        $queueName = $this->app['config']->get('queue.default');
        try {
            if (in_array($queueName, [null, 'sync', 'null'], true)) {
                throw new \RuntimeException('Asynchronous Panel queue required.');
            }
            $size = $this->app['queue']->connection($queueName)->size();
            $this->check($checks, 'queue', true, 'Panel queue ' . $queueName . ' is reachable; pending jobs ' . $size . '.');
        } catch (Throwable $e) {
            $this->check($checks, 'queue', false, 'Panel asynchronous queue is unavailable. Restore its existing database/Redis service and queue worker configuration.');
        }
        $this->check($checks, 'boot', true, 'Panel console kernel booted successfully.');
        $this->check($checks, 'maintenance-driver', $this->app['config']->get('app.maintenance.driver', 'file') === 'file', 'The tested file maintenance driver is required for standalone recovery.');
        $heartbeatFile = $stateRoot . '/worker-heartbeat.json';
        $heartbeat = is_file($heartbeatFile) ? json_decode((string) file_get_contents($heartbeatFile), true) : null;
        $worker = is_array($heartbeat) && in_array($heartbeat['status'] ?? '', ['idle', 'working'], true) && isset($heartbeat['at']) && time() - (int) $heartbeat['at'] < (($heartbeat['status'] ?? '') === 'working' ? 3600 : 120);
        $workerLockPath = $stateRoot . '/management-worker.lock';
        $workerLock = is_file($workerLockPath) ? fopen($workerLockPath, 'r') : false;
        if ($workerLock) {
            $acquired = flock($workerLock, LOCK_EX | LOCK_NB);
            $worker = $worker && !$acquired;
            if ($acquired) {
                flock($workerLock, LOCK_UN);
            }
            fclose($workerLock);
        } else {
            $worker = false;
        }
        $this->check($checks, 'management-worker', $worker, 'Run a separate supervised service: ' . PHP_BINARY . ' ' . $this->app->basePath('addon-manager/bin/manager.php') . ' worker --panel-root=' . $this->app->basePath() . '. Use the Panel file owner, never the regular game-server queue.');
        $runner = class_exists(IsolatedRunner::class) ? (new IsolatedRunner($this->app->basePath(), $stateRoot, $this->settings['runner'] ?? []))->doctor() : ['ready' => false, 'checks' => [], 'message' => 'Isolated runner component is unavailable.'];
        $this->check($checks, 'isolated-runner', ($runner['ready'] ?? false) === true, 'Addon execution requires a configured isolated runner; see runner checks.');
        try {
            $workerControl = (new WorkerControl($this->settings['workerControl'] ?? []))->doctor();
        } catch (Throwable $e) {
            $workerControl = ['ready' => false, 'message' => $e->getMessage()];
        }
        $this->check($checks, 'worker-control', $workerControl['ready'], 'Supervised queue and PHP-FPM groups must be stoppable during activation. See worker-control checks.');
        $hostChecks = array_filter($checks, static fn (array $check) => !in_array($check['name'], ['management-worker', 'isolated-runner', 'worker-control'], true));
        return ['ready' => count(array_filter($checks, static fn (array $check) => !$check['passed'])) === 0, 'hostReady' => count(array_filter($hostChecks, static fn (array $check) => !$check['passed'])) === 0, 'checks' => $checks, 'warnings' => $this->settings['baselineWarnings'] ?? [], 'runner' => $runner, 'worker' => $heartbeat, 'workerControl' => $workerControl, 'sourceProfile' => $this->settings['profile'] ?? null];
    }

    private function check(array &$checks, string $name, bool $passed, string $message): void
    {
        $checks[] = ['name' => $name, 'passed' => $passed, 'message' => $message];
    }

    private function sourceBytes(): int
    {
        $total = 0;
        $root = $this->app->basePath();
        foreach (['app', 'bootstrap', 'config', 'database', 'resources', 'routes', 'public'] as $directory) {
            if (!is_dir($root . '/' . $directory)) {
                continue;
            }
            $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($root . '/' . $directory, \FilesystemIterator::SKIP_DOTS));
            foreach ($iterator as $file) {
                if ($file->isFile() && !$file->isLink()) {
                    $total += $file->getSize();
                }
            }
        }
        return $total;
    }
}
