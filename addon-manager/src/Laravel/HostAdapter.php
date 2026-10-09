<?php

declare(strict_types=1);

namespace AddonManager\Laravel;

use Illuminate\Contracts\Console\Kernel;
use AddonManager\Lifecycle\Manager;
use AddonManager\Runner\IsolatedRunner;
use AddonManager\Storage\Files;
use RuntimeException;
use Throwable;

/** The web process queues work; this adapter's activation hooks run only in the CLI worker. */
final class HostAdapter
{
    public readonly string $panelRoot;
    public readonly string $stateRoot;
    private array $settings;
    private bool $enteredMaintenance = false;

    public function __construct(private readonly object $app, ?array $settings = null)
    {
        $this->panelRoot = $app->basePath();
        Files::noLinks($this->panelRoot);
        $stateRoot = rtrim($app->storagePath('app/addon-manager'), '/');
        if (!str_starts_with($stateRoot, '/') || preg_match('#(?:^|/)\.{1,2}(?:/|$)#', $stateRoot)) {
            throw new RuntimeException('Private manager state must use an absolute path without traversal segments.');
        }
        $stateRoot = '/' . implode('/', array_filter(explode('/', $stateRoot), static fn (string $part): bool => $part !== ''));
        Files::noLinks($stateRoot);
        $panelRoot = realpath($this->panelRoot);
        if ($panelRoot === false) {
            throw new RuntimeException('Panel root must be an existing real directory.');
        }
        foreach ([$panelRoot . '/public', $panelRoot . '/storage/app/public'] as $public) {
            if ($stateRoot === $public || str_starts_with($stateRoot, $public . '/')) {
                throw new RuntimeException('Manager state must be outside all publicly served directories.');
            }
        }
        $this->stateRoot = $stateRoot;
        $file = $this->stateRoot . '/host.json';
        Files::noLinks($file);
        $this->settings = $settings ?? (is_file($file) ? Files::json($file) : []);
    }

    public static function boot(string $panelRoot): self
    {
        $autoload = $panelRoot . '/vendor/autoload.php';
        $bootstrap = $panelRoot . '/bootstrap/app.php';
        if (!is_file($autoload) || !is_file($bootstrap)) {
            throw new RuntimeException('Panel Composer dependencies or bootstrap are missing; prepare the working Panel first.');
        }
        require_once $autoload;
        $app = require $bootstrap;
        if (!is_object($app) || realpath($app->basePath()) !== realpath($panelRoot)) {
            throw new RuntimeException('Panel bootstrap selected a different application root. Remove or correct APP_BASE_PATH before using this manager.');
        }
        $app->make(Kernel::class)->bootstrap();
        return new self($app);
    }

    public function application(): object
    {
        return $this->app;
    }

    public function manager(): Manager
    {
        $runner = class_exists(IsolatedRunner::class) ? new IsolatedRunner($this->panelRoot, $this->stateRoot, $this->settings['runner'] ?? []) : null;
        $config = [
            'defaultOwner' => 'panel',
            'baselineOwners' => $this->settings['baselineOwners'] ?? [],
            'runnerDoctor' => static fn (): array => $runner ? $runner->doctor() : ['ready' => false, 'checks' => []],
            'verifyStage' => static function (string $stage, array $manifests, array $operation) use ($runner): array {
                if (!$runner) {
                    throw new RuntimeException('A supported isolated runner must be configured before installing or enabling addons.');
                }
                return $runner->verifyStage($stage, $manifests, $operation);
            },
            'build' => static function (string $stage, array $manifests, array $operation) use ($runner): array {
                if (!$runner) {
                    throw new RuntimeException('The isolated panel-v1 build runner is unavailable.');
                }
                return $runner->build($stage, $manifests, $operation);
            },
            'beforeActivate' => fn (array $operation) => $this->beforeActivate($operation),
            'migrate' => fn (array $manifests, array $operation) => $this->migrate($manifests, $operation),
            'prepareDatabase' => fn (array $manifests, array $operation) => $this->prepareDatabase($manifests, $operation),
            'afterActivate' => fn (array $operation) => $this->afterActivate($operation),
            'healthCheck' => fn (array $operation) => $this->healthCheck($operation),
            'committed' => fn (array $operation) => $this->committed($operation),
            'beforeRollback' => fn (array $operation) => $this->beforeRollback($operation),
            'afterRollback' => fn (array $operation) => $this->afterRollback($operation),
            'afterOperation' => fn (array $registry, array $operation) => ManagerSchema::mirror($this->app['db']->connection(), $registry, $operation),
        ];
        return new Manager($this->panelRoot, $this->stateRoot, $config);
    }

    public function doctor(): array
    {
        return (new HostDoctor($this->app, $this->settings))->run();
    }

    public function installTables(): array
    {
        return ManagerSchema::install($this->app['db']->connection());
    }

    public function mirrorOperation(array $operation): void
    {
        $this->requireWorker();
        ManagerSchema::mirror($this->app['db']->connection(), $this->manager()->registry(), $operation);
    }

    public function migrate(array $manifests, array $operation): array
    {
        $this->requireWorker();
        $connection = $this->app['db']->connection();
        $backup = $operation['databaseBackup'] ?? null;
        if (!is_array($backup) || !is_file($backup['path'] ?? '') || hash_file('sha256', $backup['path']) !== ($backup['sha256'] ?? null)) {
            throw new RuntimeException('Verified pre-activation database backup receipt is missing or changed.');
        }
        $applied = (new MigrationExecutor($connection, $this->stateRoot))->apply($manifests, $operation);
        return ['compatibleRollback' => true, 'backup' => $backup, 'applied' => $applied];
    }

    public function prepareDatabase(array $manifests, array $operation): array
    {
        $this->requireWorker();
        foreach ($manifests as $manifest) {
            if (($manifest['database']['migrations'] ?? []) !== []) {
                return (new DatabaseBackup($this->app['db']->connection(), $this->stateRoot))->create($operation['id']);
            }
        }
        return ['required' => false];
    }

    public function clearCaches(): void
    {
        foreach (['config:clear', 'route:clear', 'view:clear'] as $command) {
            $this->artisan($command);
        }
        if (function_exists('opcache_reset')) {
            opcache_reset();
        }
    }

    public function readiness(): array
    {
        return $this->runReadinessProcess();
    }

    public function beforeActivate(array $operation): array
    {
        $this->requireWorker();
        if ($this->app->isDownForMaintenance()) {
            throw new RuntimeException('Panel is already in maintenance; complete that maintenance before activation.');
        }
        $control = new WorkerControl($this->settings['workerControl'] ?? []);
        if (!$control->doctor()['ready']) {
            throw new RuntimeException('Affected Panel services are unavailable or supervisor status permission is missing.');
        }
        if ($this->app['config']->get('app.maintenance.driver', 'file') !== 'file') {
            throw new RuntimeException('Standalone recovery currently requires the tested file maintenance driver.');
        }
        $this->writeMaintenanceOwner($operation['id'], 'intent');
        $this->artisan('down', ['--retry' => 15]);
        $this->enteredMaintenance = true;
        $this->writeMaintenanceOwner($operation['id'], 'entered');
        $services = $control->stop();
        return ['maintenance' => true, 'owner' => $operation['id'], 'services' => $services];
    }

    public function afterActivate(array $operation): array
    {
        $this->requireWorker();
        $this->clearCaches();
        return ['cachesRefreshed' => true, 'servicesRemainStopped' => true];
    }

    public function healthCheck(array $operation): array
    {
        $this->requireWorker();
        $this->app['db']->connection()->select('SELECT 1');
        // A new process must boot the activated Panel, not already-loaded PHP classes.
        $result = $this->runReadinessProcess($operation['candidateRegistryPath'] ?? null);
        if (!$result['ready']) {
            throw new RuntimeException('Activated Panel readiness check failed: ' . $result['message']);
        }
        return $result;
    }

    public function committed(array $operation): array
    {
        $this->requireWorker();
        $ownerFile = $this->stateRoot . '/maintenance-owner.json';
        $owner = is_file($ownerFile) ? Files::json($ownerFile) : null;
        if (($owner['operationId'] ?? null) !== $operation['id']) {
            throw new RuntimeException('Manager service ownership receipt was lost before commit; keep affected services stopped.');
        }
        ManagerSchema::mirror($this->app['db']->connection(), $this->manager()->registry(), $operation);
        (new WorkerControl($this->settings['workerControl'] ?? []))->start();
        $this->leaveOwnedMaintenance($operation['id']);
        return ['maintenance' => false];
    }

    public function afterRollback(array $operation): array
    {
        $this->requireWorker();
        $this->clearCaches();
        $readiness = $this->runReadinessProcess();
        if (!$readiness['ready']) {
            throw new RuntimeException('Restored Panel failed readiness; keep maintenance and stopped services.');
        }
        ManagerSchema::mirror($this->app['db']->connection(), $this->manager()->registry(), array_replace($operation, ['status' => 'failed']));
        $ownerFile = $this->stateRoot . '/maintenance-owner.json';
        $owner = is_file($ownerFile) ? json_decode((string) file_get_contents($ownerFile), true, 16, JSON_THROW_ON_ERROR) : null;
        if ($owner !== null && $owner['operationId'] === $operation['id']) {
            (new WorkerControl($this->settings['workerControl'] ?? []))->start();
        }
        $this->leaveOwnedMaintenance($operation['id']);
        return ['maintenance' => $this->app->isDownForMaintenance(), 'cachesRefreshed' => true];
    }

    public function beforeRollback(array $operation): array
    {
        $this->requireWorker();
        $file = $this->stateRoot . '/maintenance-owner.json';
        $owner = is_file($file) ? json_decode((string) file_get_contents($file), true, 16, JSON_THROW_ON_ERROR) : null;
        if ($owner === null || $owner['operationId'] !== $operation['id']) {
            $journalFile = $this->stateRoot . '/journals/' . $operation['id'] . '.json';
            $journal = is_file($journalFile) ? Files::json($journalFile) : null;
            if (($journal['status'] ?? null) === 'prepared') {
                return ['services' => 'unchanged', 'activation' => 'not-started'];
            }
            throw new RuntimeException('Cannot prove service ownership before restoring activated files; keep maintenance and establish quiescence first.');
        }
        if (!$this->app->isDownForMaintenance()) {
            $this->artisan('down', ['--retry' => 15]);
        }
        return (new WorkerControl($this->settings['workerControl'] ?? []))->stop();
    }

    private function artisan(string $command, array $arguments = []): void
    {
        $status = $this->app->make(Kernel::class)->call($command, $arguments);
        if ($status !== 0) {
            throw new RuntimeException('Required Panel command failed: php artisan ' . $command . ' (exit ' . $status . ').');
        }
    }

    private function requireWorker(): void
    {
        if (PHP_SAPI !== 'cli' || !defined('ADDON_MANAGER_WORKER') || ADDON_MANAGER_WORKER !== true) {
            throw new RuntimeException('Activation hooks may run only in the dedicated management worker.');
        }
    }

    private function writeMaintenanceOwner(string $id, string $phase): void
    {
        Files::writeJson($this->stateRoot . '/maintenance-owner.json', ['operationId' => $id, 'phase' => $phase, 'at' => gmdate('c')]);
    }

    public function leaveOwnedMaintenance(string $id): void
    {
        $file = $this->stateRoot . '/maintenance-owner.json';
        $owner = is_file($file) ? json_decode((string) file_get_contents($file), true, 16, JSON_THROW_ON_ERROR) : null;
        if ($owner === null || $owner['operationId'] !== $id) {
            return;
        }
        $this->artisan('up');
        // Keep the operation receipt through the lifecycle's final durable journal
        // write. A crash after `up` still has enough authority to re-quiesce safely.
        $this->writeMaintenanceOwner($id, 'released');
        $this->enteredMaintenance = false;
    }

    private function runReadinessProcess(?string $candidateRegistry = null): array
    {
        $command = [PHP_BINARY, dirname(__DIR__, 2) . '/bin/manager.php', 'readiness', '--panel-root=' . $this->panelRoot];
        if ($candidateRegistry !== null) {
            if (realpath($candidateRegistry) !== realpath($this->stateRoot . '/candidate-registry.json')) {
                throw new RuntimeException('Unexpected candidate registry path.');
            }
            $command[] = '--candidate-registry=' . $candidateRegistry;
        }
        $process = proc_open($command, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $this->panelRoot);
        if (!is_resource($process)) {
            return ['ready' => false, 'message' => 'Could not start independent Panel readiness process.'];
        }
        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);
        $output = '';
        $diagnosticBytes = 0;
        $terminated = false;
        $deadline = microtime(true) + 30;
        do {
            $output .= stream_get_contents($pipes[1], 65536);
            // Keep diagnostics bounded; no environment values are printed.
            $diagnosticBytes += strlen(stream_get_contents($pipes[2], 65536));
            $status = proc_get_status($process);
            if (!$status['running']) {
                break;
            }
            if (microtime(true) > $deadline || strlen($output) + $diagnosticBytes > 1048576) {
                proc_terminate($process);
                $killDeadline = microtime(true) + 1;
                do {
                    stream_get_contents($pipes[1], 65536);
                    stream_get_contents($pipes[2], 65536);
                    $status = proc_get_status($process);
                    if (!$status['running']) break;
                    usleep(20000);
                } while (microtime(true) < $killDeadline);
                if ($status['running']) proc_terminate($process, 9);
                $terminated = true;
                break;
            }
            usleep(20000);
        } while (true);
        $output .= stream_get_contents($pipes[1], 65536);
        fclose($pipes[1]);
        fclose($pipes[2]);
        $exit = proc_close($process);
        $exit = $exit === -1 ? ($status['exitcode'] ?? -1) : $exit;
        if ($terminated) {
            return ['ready' => false, 'message' => 'Independent Panel readiness exceeded its time or output limit.'];
        }
        if ($exit !== 0) {
            return ['ready' => false, 'message' => 'Independent Panel boot, database, or manager route check failed (exit ' . $exit . ').'];
        }
        $decoded = json_decode($output, true);
        return is_array($decoded) && ($decoded['ready'] ?? false) ? $decoded : ['ready' => false, 'message' => 'Readiness process returned an invalid response.'];
    }
}
