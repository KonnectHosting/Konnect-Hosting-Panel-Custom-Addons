<?php

declare(strict_types=1);

namespace AddonManager\Lifecycle;

use AddonManager\Core\ArchiveExtractor;
use AddonManager\Core\GitHubDownloader;
use AddonManager\Core\PackageValidator;
use AddonManager\Storage\Files;
use RuntimeException;
use Throwable;

/** A dependency-free coordinator usable even when modified Laravel cannot boot. */
final class Manager
{
    private string $panelRoot;
    private string $stateRoot;
    private array $config;
    private DependencyPlanner $planner;
    private Activator $activator;

    public function __construct(string $panelRoot, ?string $stateRoot = null, array $config = [])
    {
        Files::noLinks($panelRoot);
        $canonical = realpath($panelRoot);
        if ($canonical === false || !is_dir($canonical)) {
            throw new RuntimeException('Panel root must be an existing real directory.');
        }
        $this->panelRoot = rtrim($canonical, '/');
        $stateRoot ??= $this->panelRoot . '/storage/app/addon-manager';
        if (!str_starts_with($stateRoot, '/')) {
            $stateRoot = $this->panelRoot . '/' . $stateRoot;
        }
        Files::noLinks($stateRoot);
        $this->rejectPublicState($stateRoot);
        Files::directory($stateRoot);
        $this->stateRoot = rtrim((string) realpath($stateRoot), '/');
        if ($this->stateRoot === $this->panelRoot) {
            throw new RuntimeException('Private state cannot be the Panel root.');
        }
        $this->rejectPublicState($this->stateRoot);
        $this->config = $config;
        $this->planner = new DependencyPlanner();
        $this->activator = new Activator($this->panelRoot, $this->stateRoot, $config);
        foreach (['operations', 'journals', 'packages', 'baselines', 'staging', 'backups', 'database-backups', 'intake', 'requests'] as $directory) {
            Files::directory($this->stateRoot . '/' . $directory);
        }
    }

    public function initialize(array $host): array
    {
        $lock = Files::lock($this->stateRoot . '/deployment.lock');
        try {
            if (is_file($this->stateRoot . '/registry.json')) {
                $registry = $this->registry();
                $recordedSource = array_diff_key($registry['host'], array_flip(['php', 'manager']));
                $detectedSource = array_diff_key($host, array_flip(['php', 'manager']));
                if ($recordedSource != $detectedSource) {
                    throw new RuntimeException('Host identity changed. Baseline rebase requires an explicit maintenance workflow.');
                }
                $this->assertNoRecovery();
                $this->assertLiveInventory($registry['activeInventory']);
                return $registry;
            }
            foreach (['panel', 'php', 'manager'] as $product) {
                if (!isset($host[$product]) || !is_string($host[$product]) || $host[$product] === '') {
                    throw new RuntimeException("Actual host version is required: {$product}");
                }
            }
            $inventory = $this->liveInventory();
            if ($inventory === []) {
                throw new RuntimeException('Cannot capture an empty baseline.');
            }
            $baselineId = hash('sha256', json_encode(['host' => $host, 'inventory' => $inventory], JSON_THROW_ON_ERROR));
            $baselineRoot = $this->stateRoot . '/baselines/' . $baselineId . '/files';
            Files::copyInventory($this->panelRoot, $baselineRoot, $inventory);
            $this->assertLiveInventory($inventory);
            Files::writeJson(dirname($baselineRoot) . '/metadata.json', ['id' => $baselineId, 'host' => $host, 'inventory' => $inventory, 'createdAt' => gmdate(DATE_ATOM)]);
            $registry = [
                'schemaVersion' => 1, 'host' => $host, 'baselineId' => $baselineId,
                'baselineRoot' => $baselineRoot, 'baselineInventory' => $inventory,
                'addons' => [], 'activeInventory' => $inventory, 'enabledOrder' => [], 'ledger' => [],
                'createdAt' => gmdate(DATE_ATOM), 'updatedAt' => gmdate(DATE_ATOM),
            ];
            $currentHost = $this->currentHost($host);
            $registry['observedRuntime'] = ['php' => $currentHost['php'], 'manager' => $currentHost['manager'], 'verifiedAt' => gmdate(DATE_ATOM)];
            Files::writeJson($this->stateRoot . '/registry.json', $registry);
            return $registry;
        } finally {
            fclose($lock);
        }
    }

    public function registry(): array
    {
        if (!is_file($this->stateRoot . '/registry.json')) {
            throw new RuntimeException('Manager is not initialized; run the initial installer first.');
        }
        return Files::json($this->stateRoot . '/registry.json');
    }

    public function listing(): array
    {
        $registry = $this->registry();
        $addons = $registry['addons'];
        ksort($addons, SORT_STRING);
        $result = [];
        foreach ($addons as $id => $addon) {
            $addon['dependencies'] = $addon['manifest']['dependencies'];
            $addon['dependents'] = $this->planner->dependents($addons, $id, false);
            if (isset($addon['lastOperationId'])) {
                $last = $this->operation($addon['lastOperationId']);
                $addon['lastOperation'] = array_intersect_key($last, array_flip(['id', 'status', 'action', 'message', 'error']));
            }
            $result[] = $addon;
        }
        return $result;
    }

    /** HTTP handlers call only this cheap operation; the dedicated worker does the work. */
    public function enqueue(string $action, array $arguments, string $actor = 'cli', ?string $requestId = null): array
    {
        $this->registry();
        $this->assertNoRecovery(true);
        if (!in_array($action, ['install', 'update', 'enable', 'disable', 'delete'], true)) {
            throw new RuntimeException('Unsupported lifecycle action.');
        }
        foreach ($arguments as $key => $value) {
            if (!in_array($key, ['url', 'packageRoot', 'addonId', 'cascade', 'expectedAffectedIds'], true)) {
                throw new RuntimeException("Unsupported operation argument: {$key}");
            }
        }
        if (in_array($action, ['install', 'update'], true)) {
            if ((isset($arguments['url']) ? 1 : 0) + (isset($arguments['packageRoot']) ? 1 : 0) !== 1) {
                throw new RuntimeException('Provide exactly one GitHub URL or local packageRoot.');
            }
            foreach (['url', 'packageRoot'] as $key) {
                if (isset($arguments[$key]) && (!is_string($arguments[$key]) || $arguments[$key] === '' || strlen($arguments[$key]) > 4096)) {
                    throw new RuntimeException("Invalid {$key}.");
                }
            }
            if (isset($arguments['url'])) {
                $url = parse_url($arguments['url']);
                if ($url === false || isset($url['user']) || isset($url['pass'])) {
                    throw new RuntimeException('Package URLs cannot contain credentials.');
                }
            }
        }
        if (($action !== 'install' && !isset($arguments['addonId'])) || (isset($arguments['addonId']) && (!is_string($arguments['addonId']) || !preg_match('/^[a-z0-9][a-z0-9._-]{1,127}$/D', $arguments['addonId'])))) {
            throw new RuntimeException('A valid addonId is required.');
        }
        if (isset($arguments['cascade']) && !is_bool($arguments['cascade'])) {
            throw new RuntimeException('cascade must be a boolean.');
        }
        if (isset($arguments['expectedAffectedIds'])) {
            $ids = $arguments['expectedAffectedIds'];
            if (!in_array($action, ['disable', 'delete'], true) || !is_array($ids) || !array_is_list($ids) || $ids === [] || count($ids) > 1000) {
                throw new RuntimeException('expectedAffectedIds must be a nonempty list for disable/delete.');
            }
            foreach ($ids as $id) {
                if (!is_string($id) || !preg_match('/^[a-z0-9][a-z0-9._-]{1,127}$/D', $id)) {
                    throw new RuntimeException('Invalid expected affected addon ID.');
                }
            }
            if (count(array_unique($ids, SORT_STRING)) !== count($ids)) {
                throw new RuntimeException('expectedAffectedIds cannot contain duplicates.');
            }
            sort($ids, SORT_STRING);
            $arguments['expectedAffectedIds'] = $ids;
        }
        if ($requestId !== null && ($requestId === '' || strlen($requestId) > 200 || preg_match('/[\x00-\x1f]/', $requestId))) {
            throw new RuntimeException('Invalid idempotency requestId.');
        }
        if ($actor === '' || strlen($actor) > 255) {
            throw new RuntimeException('Invalid operation actor.');
        }
        ksort($arguments, SORT_STRING);
        $lock = Files::lock($this->stateRoot . '/queue.lock');
        try {
            $requestPath = $requestId === null ? null : $this->stateRoot . '/requests/' . hash('sha256', $actor . "\0" . $requestId) . '.json';
            if ($requestPath !== null && is_file($requestPath)) {
                $request = Files::json($requestPath);
                $existing = $this->operation($request['operationId']);
                if ($existing['action'] !== $action || $existing['arguments'] !== $arguments) {
                    throw new RuntimeException('requestId was already used for different operation arguments.');
                }
                return $existing;
            }
            // Scan bridges a crash between writing the operation and its idempotency index.
            if ($requestId !== null) {
                foreach ($this->operations() as $existing) {
                    if ($existing['actor'] === $actor && $existing['requestId'] === $requestId) {
                        if ($existing['action'] !== $action || $existing['arguments'] !== $arguments) {
                            throw new RuntimeException('requestId was already used for different operation arguments.');
                        }
                        Files::writeJson($requestPath, ['operationId' => $existing['id']]);
                        return $existing;
                    }
                }
            }
            $queue = Files::json($this->stateRoot . '/queue-sequence.json', ['next' => 1]);
            $sequence = $queue['next'];
            if (!is_int($sequence) || $sequence < 1 || $sequence === PHP_INT_MAX) {
                throw new RuntimeException('Operation queue sequence is invalid.');
            }
            Files::writeJson($this->stateRoot . '/queue-sequence.json', ['next' => $sequence + 1]);
            $operation = [
                'id' => gmdate('YmdHis') . '-' . bin2hex(random_bytes(12)), 'status' => 'queued',
                'sequence' => $sequence,
                'action' => $action, 'arguments' => $arguments, 'actor' => $actor, 'requestId' => $requestId,
                'createdAt' => gmdate(DATE_ATOM), 'updatedAt' => gmdate(DATE_ATOM),
                'phase' => 'queued', 'progress' => 0, 'message' => 'Waiting for the dedicated manager worker.', 'logs' => [],
            ];
            if (in_array($action, ['disable', 'delete'], true)) {
                $operation['approval'] = $this->cascadeApproval($this->registry()['addons'], $action, $arguments);
                if (isset($arguments['expectedAffectedIds']) && $arguments['expectedAffectedIds'] !== $operation['approval']['affectedIds']) {
                    throw new RuntimeException('Affected addons changed since the action preview. Reload the addon list and review the current IDs: ' . implode(', ', $operation['approval']['affectedIds']));
                }
            }
            $this->saveOperation($operation);
            if ($requestPath !== null) {
                Files::writeJson($requestPath, ['operationId' => $operation['id']]);
            }
            return $operation;
        } finally {
            fclose($lock);
        }
    }

    public function operation(string $id): array
    {
        return Files::json($this->operationPath($id));
    }

    public function workOnce(): ?array
    {
        $lock = Files::lock($this->stateRoot . '/deployment.lock', false);
        if ($lock === null) {
            return null;
        }
        try {
            $this->assertNoRecovery();
            $operation = null;
            foreach ($this->operations() as $candidate) {
                if ($candidate['status'] === 'queued') {
                    $operation = $candidate;
                    break;
                }
            }
            if ($operation === null) {
                return null;
            }
            $operation['status'] = 'running';
            $this->progress($operation, 'planning', 5, 'Checking active source and desired dependencies.');
            $journal = null;
            try {
                $before = $this->registry();
                $this->assertLiveInventory($before['activeInventory']);
                $addons = $this->desiredAddons($before, $operation);
                $currentHost = $this->currentHost($before['host']);
                $order = $this->planner->order($addons, $currentHost);
                $operation['validatedHost'] = $currentHost;
                $stageRoot = $this->stateRoot . '/staging/' . $operation['id'] . '/files';
                Files::directory($stageRoot);
                $operation['stageRoot'] = $stageRoot;
                $operation['packages'] = [];
                $manifests = [];
                foreach ($order as $id) {
                    $manifests[$id] = $addons[$id]['manifest'];
                    $operation['packages'][$id] = array_intersect_key($addons[$id], array_flip(['packagePath', 'packageDigest', 'manifest', 'source']));
                }
                $operation['buildPlan'] = $this->buildPlan($before['addons'], $addons);
                $this->progress($operation, 'staging', 30, 'Reconstructing from the protected baseline and frozen packages.');
                $composed = (new Composer())->compose(
                    $before['baselineRoot'], $before['baselineInventory'], $stageRoot, $addons, $order,
                    $this->config['baselineOwners'] ?? [], $this->config['defaultOwner'] ?? 'panel'
                );
                $this->progress($operation, 'validation', 45, 'Verifying syntax, isolated integration checks, and declared build output.');
                $composed = $this->validateStage($composed, $manifests, $operation, $before['baselineInventory']);
                if ($this->hasMigrations($manifests) && (!isset($this->config['prepareDatabase']) || !isset($this->config['migrate']))) {
                    throw new RuntimeException('Declarative schema changes require the host database snapshot and migration adapters before activation.');
                }
                foreach ($composed['ledger'] as &$entry) {
                    $entry['baselineId'] = $before['baselineId'];
                    $entry['operationId'] = $operation['id'];
                    if (isset($entry['addonId'])) {
                        $entry['packageDigest'] = $addons[$entry['addonId']]['packageDigest'];
                    }
                }
                unset($entry);
                $after = $before;
                $after['observedRuntime'] = ['php' => $currentHost['php'], 'manager' => $currentHost['manager'], 'verifiedAt' => gmdate(DATE_ATOM)];
                $after['addons'] = $addons;
                $after['activeInventory'] = $composed['inventory'];
                $after['ledger'] = $composed['ledger'];
                $after['enabledOrder'] = $order;
                $after['updatedAt'] = gmdate(DATE_ATOM);
                $after['lastOperationId'] = $operation['id'];
                foreach ($operation['affectedAddons'] as $id) {
                    if (isset($after['addons'][$id])) {
                        $after['addons'][$id]['lastOperationId'] = $operation['id'];
                    }
                }
                $operation['candidateRegistryPath'] = $this->stateRoot . '/candidate-registry.json';
                Files::writeJson($operation['candidateRegistryPath'], $after);
                $this->saveOperation($operation);
                $this->assertLiveInventory($before['activeInventory']);
                $this->progress($operation, 'backup', 60, 'Preparing verified file backups and the recovery journal.');
                $journal = $this->activator->prepare($operation, $before, $after);
                $this->progress($operation, 'maintenance', 65, 'Entering maintenance and quiescing affected workers.');
                $journal['maintenanceEntered'] = true; // durable intent precedes the host callback
                $this->activator->save($journal);
                $this->callback('beforeActivate', [$operation]);
                if ($this->hasMigrations($manifests)) {
                    $this->progress($operation, 'database-backup', 67, 'Creating and verifying a private database snapshot before code or schema activation.');
                    $backup = $this->verifiedDatabaseBackup($this->callback('prepareDatabase', [$manifests, $operation]));
                    $operation['databaseBackup'] = $backup;
                    $journal['database']['backup'] = $backup;
                    $journal['database']['status'] = 'backup-ready';
                    $this->activator->save($journal);
                    $this->saveOperation($operation);
                    $this->activator->checkpoint('databaseBackupReady', $operation, $journal);
                }
                $this->progress($operation, 'activation', 70, 'Activating verified files with a durable per-file journal.');
                $this->activator->activate($journal, $operation);
                $this->activator->checkpoint('beforeMigrate', $operation, $journal);
                if ($this->hasMigrations($manifests)) {
                    $this->progress($operation, 'migration', 80, 'Applying manager-owned additive migrations; addon data is retained.');
                    $journal['database'] = array_merge($journal['database'], ['status' => 'started', 'compatibleRollback' => false]);
                    $this->activator->save($journal);
                    $migration = $this->callback('migrate', [$manifests, $operation]);
                    if (!is_array($migration) || ($migration['compatibleRollback'] ?? false) !== true) {
                        throw new RuntimeException('Migration adapter did not confirm compatibility with the previous code; recovery requires operator review.');
                    }
                    $journal['database'] = array_merge($journal['database'], ['status' => 'applied', 'compatibleRollback' => true, 'result' => $migration]);
                    $this->activator->save($journal);
                }
                $this->activator->checkpoint('afterMigrate', $operation, $journal);
                $this->progress($operation, 'health', 90, 'Refreshing processes and checking host readiness.');
                $this->callback('afterActivate', [$operation]);
                $this->callback('healthCheck', [$operation]);
                $this->assertLiveInventory($after['activeInventory']);
                $this->activator->checkpoint('beforeRegistryCommit', $operation, $journal);
                Files::writeJson($this->stateRoot . '/registry.json', $after);
                $journal['registryCommitted'] = true;
                $journal['status'] = 'registry-committed';
                $this->activator->save($journal);
                $this->activator->checkpoint('afterRegistryCommit', $operation, $journal);
                $this->callback('committed', [$operation]);
                $journal['status'] = 'completed';
                $this->activator->save($journal);
                $operation['status'] = 'succeeded';
                $this->progress($operation, 'complete', 100, 'Lifecycle operation completed; addon data is preserved.');
            } catch (Throwable $error) {
                $operation['error'] = $error->getMessage();
                if ($journal === null && is_file($this->stateRoot . '/journals/' . $operation['id'] . '.json')) {
                    $journal = $this->activator->journal($operation['id']);
                }
                $this->handleFailure($operation, $journal);
            }
            $this->observeOperation($operation);
            return $operation;
        } finally {
            fclose($lock);
        }
    }

    public function recover(?string $operationId = null): array
    {
        $lock = Files::lock($this->stateRoot . '/deployment.lock');
        try {
            $results = [];
            $candidates = $operationId === null ? $this->operations() : [$this->operation($operationId)];
            foreach ($candidates as $operation) {
                if (!in_array($operation['status'], ['running', 'recovery_required'], true)) {
                    continue;
                }
                $id = $operation['id'];
                $path = $this->stateRoot . '/journals/' . $id . '.json';
                if (!is_file($path)) {
                    $operation['status'] = 'recovered';
                    $this->progress($operation, 'recovered', 100, 'Interrupted preparation discarded; live files were unchanged.');
                    $this->observeOperation($operation);
                    $results[] = $operation;
                    continue;
                }
                $journal = $this->activator->journal($id);
                try {
                    if ($journal['status'] === 'completed') {
                        $this->assertLiveInventory($journal['afterRegistry']['activeInventory']);
                        $operation['status'] = 'succeeded';
                        $this->progress($operation, 'complete', 100, 'Recovered durable completion of the operation.');
                    } else {
                        if ($journal['maintenanceEntered']) {
                            $this->callback('beforeRollback', [$operation]);
                        }
                        $this->activator->rollback($journal, $operation);
                        if (($journal['database']['compatibleRollback'] ?? false) !== true) {
                            throw new RuntimeException('Files restored. Database changes may have committed; keep maintenance enabled and reconcile migration history/backup before reopening.');
                        }
                        $this->assertLiveInventory($journal['beforeRegistry']['activeInventory']);
                        if ($journal['maintenanceEntered']) {
                            $this->callback('afterRollback', [$operation]);
                        }
                        $journal['status'] = 'recovered';
                        $this->activator->save($journal);
                        $operation['status'] = 'recovered';
                        $this->progress($operation, 'recovered', 100, 'Restored the previous verified filesystem and registry; retained schema/data.');
                    }
                } catch (Throwable $error) {
                    $operation['status'] = 'recovery_required';
                    $operation['error'] = $error->getMessage();
                    $this->progress($operation, 'recovery', 100, $error->getMessage());
                }
                $this->observeOperation($operation);
                $results[] = $operation;
            }
            return ['operations' => $results, 'ok' => count(array_filter($results, static fn (array $operation): bool => $operation['status'] === 'recovery_required')) === 0];
        } finally {
            fclose($lock);
        }
    }

    public function doctor(): array
    {
        $checks = [];
        $check = static function (string $name, callable $test) use (&$checks): void {
            try {
                $detail = $test();
                $checks[] = ['name' => $name, 'ok' => true, 'message' => is_string($detail) ? $detail : 'Passed.'];
            } catch (Throwable $error) {
                $checks[] = ['name' => $name, 'ok' => false, 'message' => $error->getMessage()];
            }
        };
        $check('php', static function (): string {
            if (PHP_VERSION_ID < 80200) {
                throw new RuntimeException('PHP 8.2 or later is required.');
            }
            return PHP_VERSION;
        });
        $check('private-state', function (): string {
            $this->rejectPublicState($this->stateRoot);
            if (!is_writable($this->stateRoot)) {
                throw new RuntimeException('Private state is not writable by the dedicated worker.');
            }
            return $this->stateRoot;
        });
        $check('registry', fn (): string => 'Baseline ' . $this->registry()['baselineId']);
        $check('php-runtime', function (): string {
            $currentHost = $this->currentHost($this->registry()['host']);
            return 'Current compatibility runtime: PHP ' . $currentHost['php'] . ', manager ' . $currentHost['manager'] . '.';
        });
        $check('runtime-compatibility', function (): string {
            $registry = $this->registry();
            $this->planner->order($registry['addons'], $this->currentHost($registry['host']));
            return 'Enabled addons support the current runtime and verified host source versions.';
        });
        $check('baseline', function (): string {
            $registry = $this->registry();
            if (Files::inventory($registry['baselineRoot']) !== $registry['baselineInventory']) {
                throw new RuntimeException('Protected baseline files are missing or changed.');
            }
            return 'Protected baseline matches its recorded inventory.';
        });
        $check('source-drift', function (): string {
            $this->assertLiveInventory($this->registry()['activeInventory']);
            return 'Active managed source matches its recorded inventory.';
        });
        $check('recovery', function (): string {
            $this->assertNoRecovery();
            return 'No interrupted deployment requires recovery.';
        });
        $check('frozen-packages', function (): string {
            foreach ($this->registry()['addons'] as $addon) {
                $manifest = (new PackageValidator())->validate($addon['packagePath']);
                if ($manifest !== $addon['manifest'] || $this->packageDigest($addon['packagePath']) !== $addon['packageDigest']) {
                    throw new RuntimeException("Frozen package changed: {$addon['id']}");
                }
            }
            return 'Every retained package is intact.';
        });
        $runner = ['ready' => false, 'message' => 'No isolated execution/build runner configured. Execution-dependent packages remain blocked.'];
        if (isset($this->config['runnerDoctor'])) {
            try {
                $runner = ($this->config['runnerDoctor'])();
            } catch (Throwable $error) {
                $runner = ['ready' => false, 'message' => $error->getMessage()];
            }
        } elseif (($this->config['isolatedRunner'] ?? false) === true && isset($this->config['verifyStage'])) {
            $runner = ['ready' => true, 'message' => 'Host supplied an isolated stage verifier.'];
        }
        return ['ok' => count(array_filter($checks, static fn (array $row): bool => !$row['ok'])) === 0, 'checks' => $checks, 'runner' => $runner, 'stateRoot' => $this->stateRoot];
    }

    private function desiredAddons(array $registry, array &$operation): array
    {
        $addons = $registry['addons'];
        $action = $operation['action'];
        $arguments = $operation['arguments'];
        $id = $arguments['addonId'] ?? null;
        if (in_array($action, ['disable', 'delete'], true) && isset($operation['approval'])) {
            $currentApproval = $this->cascadeApproval($addons, $action, $arguments);
            if ($currentApproval !== $operation['approval']) {
                $operation['affectedAddons'] = $currentApproval['affectedIds'];
                throw new RuntimeException('Affected addon versions or dependency graph changed after enqueue. Reload and review a new action. Current affected IDs: ' . implode(', ', $currentApproval['affectedIds']));
            }
        }
        if (in_array($action, ['install', 'update'], true)) {
            $this->progress($operation, 'package', 15, 'Resolving, validating, and freezing the exact package bytes.');
            $record = $this->freezePackage($operation);
            if ($action === 'install') {
                $id = $record['id'];
                if (isset($addons[$id])) {
                    throw new RuntimeException("{$id} is already installed; use Update.");
                }
                $record['enabled'] = true;
            } else {
                if (!isset($addons[$id])) {
                    throw new RuntimeException("Addon is not installed: {$id}");
                }
                if ($record['id'] !== $id) {
                    throw new RuntimeException("Update package ID {$record['id']} differs from {$id}.");
                }
                $record['enabled'] = $addons[$id]['enabled'];
                $record['installedAt'] = $addons[$id]['installedAt'];
                $record['previousVersions'] = [...($addons[$id]['previousVersions'] ?? []), array_intersect_key($addons[$id], array_flip(['version', 'packageDigest', 'packagePath', 'source']))];
            }
            $addons[$id] = $record;
        } else {
            if (!isset($addons[$id])) {
                throw new RuntimeException("Addon is not installed: {$id}");
            }
            if ($action === 'enable') {
                $addons[$id]['enabled'] = true;
            } else {
                $dependents = $this->planner->dependents($addons, $id, $action !== 'delete');
                if ($dependents !== [] && !($arguments['cascade'] ?? false)) {
                    $operation['affectedAddons'] = [$id, ...$dependents];
                    throw new RuntimeException("{$id} has enabled dependents: " . implode(', ', $dependents) . '. Explicit cascade is required.');
                }
                foreach ($dependents as $dependent) {
                    $addons[$dependent]['enabled'] = false;
                }
                if ($action === 'delete') {
                    // Frozen versions remain recovery checkpoints. Schema and addon data are never purged here.
                    foreach ([$id, ...$dependents] as $deleted) {
                        unset($addons[$deleted]);
                    }
                } else {
                    $addons[$id]['enabled'] = false;
                }
                $operation['affectedAddons'] = [$id, ...$dependents];
            }
        }
        $operation['addonId'] = $id;
        $operation['affectedAddons'] ??= [$id];
        if ($action === 'update') {
            $operation['affectedAddons'] = [$id, ...$this->planner->dependents($addons, $id)];
        }
        ksort($addons, SORT_STRING);
        $this->saveOperation($operation);
        return $addons;
    }

    private function freezePackage(array $operation): array
    {
        $arguments = $operation['arguments'];
        $source = ['type' => 'local'];
        if (isset($arguments['packageRoot'])) {
            $packageRoot = realpath($arguments['packageRoot']);
            if ($packageRoot === false || !is_dir($packageRoot)) {
                throw new RuntimeException('Local package root does not exist.');
            }
            Files::noLinks($arguments['packageRoot']);
        } else {
            $intake = $this->stateRoot . '/intake/' . $operation['id'];
            Files::directory($intake);
            $downloader = $this->config['downloader'] ?? new GitHubDownloader();
            $download = $downloader->download($arguments['url'], $intake . '/download');
            $archive = $download['archive'] ?? $download['path'] ?? null;
            if (!is_string($archive) || !is_file($archive)) {
                throw new RuntimeException('Downloader did not return an archive path.');
            }
            $digest = Files::hash($archive);
            if (!isset($download['sha256']) || !hash_equals($download['sha256'], $digest)) {
                throw new RuntimeException('Received archive checksum differs from downloader receipt.');
            }
            $extractor = $this->config['extractor'] ?? new ArchiveExtractor();
            $packageRoot = $extractor->extract($archive, $intake . '/extracted', $download['folder'] ?? null);
            $source = $download['source'] ?? ['type' => 'github', 'url' => $arguments['url']];
            $source['archiveSha256'] = $digest;
        }
        $manifest = (new PackageValidator())->validate($packageRoot);
        $inventory = Files::inventory($packageRoot);
        $digest = hash('sha256', json_encode($inventory, JSON_THROW_ON_ERROR));
        $frozen = $this->stateRoot . '/packages/' . $manifest['id'] . '/' . $manifest['version'] . '-' . $digest;
        if (!is_dir($frozen)) {
            Files::copyInventory($packageRoot, $frozen, $inventory);
        }
        $verified = (new PackageValidator())->validate($frozen);
        if ($verified !== $manifest || $this->packageDigest($frozen) !== $digest) {
            throw new RuntimeException('Frozen package verification failed; package quarantined.');
        }
        return [
            'id' => $manifest['id'], 'name' => $manifest['name'], 'version' => $manifest['version'],
            'manifest' => $manifest, 'packageDigest' => $digest, 'packagePath' => $frozen, 'source' => $source,
            'enabled' => false, 'installedAt' => gmdate(DATE_ATOM), 'updatedAt' => gmdate(DATE_ATOM), 'previousVersions' => [],
        ];
    }

    private function packageDigest(string $root): string
    {
        return hash('sha256', json_encode(Files::inventory($root), JSON_THROW_ON_ERROR));
    }

    private function cascadeApproval(array $addons, string $action, array $arguments): array
    {
        $id = $arguments['addonId'];
        $dependents = $this->planner->dependents($addons, $id, $action !== 'delete');
        $related = [$id, ...$dependents];
        sort($related, SORT_STRING);
        $affected = ($arguments['cascade'] ?? false) ? $related : [$id];
        $graph = [];
        foreach ($related as $relatedId) {
            if (!isset($addons[$relatedId])) {
                $graph[$relatedId] = null;
                continue;
            }
            $addon = $addons[$relatedId];
            $dependencies = $addon['manifest']['dependencies'];
            usort($dependencies, static fn (array $left, array $right): int => $left['id'] <=> $right['id']);
            $graph[$relatedId] = ['version' => $addon['version'], 'packageDigest' => $addon['packageDigest'], 'enabled' => $addon['enabled'], 'dependencies' => $dependencies];
        }
        return ['affectedIds' => $affected, 'graphFingerprint' => hash('sha256', json_encode($graph, JSON_THROW_ON_ERROR))];
    }

    private function validateStage(array $composed, array $manifests, array &$operation, array $baselineInventory): array
    {
        $stageRoot = $operation['stageRoot'];
        $operation['validation'] = [];
        $requiresExecution = $operation['buildPlan']['required'];
        foreach ($manifests as $manifest) {
            foreach ($manifest['extensions'] as $entries) {
                if ($entries !== []) {
                    $requiresExecution = true;
                }
            }
        }
        $syntax = $this->syntax($stageRoot, $composed['inventory'], $baselineInventory);
        $operation['validation'][] = ['name' => 'php-syntax', 'ok' => true, 'checkedFiles' => $syntax['checkedFiles'], 'unchangedBaselineFiles' => $syntax['unchangedBaselineFiles']];
        if ($operation['buildPlan']['required']) {
            if (!isset($this->config['build'])) {
                throw new RuntimeException('A matched, isolated Panel build runner is required for native frontend changes.');
            }
            $beforeBuild = Files::inventory($stageRoot);
            $result = $this->callback('build', [$stageRoot, $manifests, $operation]);
            if (!is_array($result) || ($result['isolated'] ?? false) !== true) {
                throw new RuntimeException('Build runner did not attest enforced filesystem/network isolation.');
            }
            $afterBuild = Files::inventory($stageRoot);
            foreach (array_unique([...array_keys($beforeBuild), ...array_keys($afterBuild)]) as $path) {
                if (($beforeBuild[$path] ?? null) === ($afterBuild[$path] ?? null)) {
                    continue;
                }
                $allowed = false;
                foreach ($operation['buildPlan']['outputs'] as $prefix) {
                    if ($path === $prefix || str_starts_with($path, rtrim($prefix, '/') . '/')) {
                        $allowed = true;
                    }
                }
                if (!$allowed || preg_match('/\.(?:php[0-9]?|phtml|phar)(?:\.|$)/i', $path)) {
                    throw new RuntimeException("Build produced an undeclared or executable output: {$path}");
                }
                $composed['ledger'][] = ['kind' => 'generated', 'target' => $path, 'owner' => 'manager:panel-build', 'preSha256' => $beforeBuild[$path] ?? null, 'postSha256' => $afterBuild[$path] ?? null];
            }
            $composed['inventory'] = $afterBuild;
            $operation['validation'][] = ['name' => 'isolated-panel-build', 'ok' => true, 'result' => $result];
        }
        if (isset($this->config['verifyStage'])) {
            $beforeVerification = Files::inventory($stageRoot);
            $result = $this->callback('verifyStage', [$stageRoot, $manifests, $operation]);
            if ($requiresExecution && (!is_array($result) || ($result['isolated'] ?? false) !== true)) {
                throw new RuntimeException('Execution-dependent extensions require an enforced isolated runner.');
            }
            if (Files::inventory($stageRoot) !== $beforeVerification) {
                throw new RuntimeException('Integration verifier changed staged code; undeclared changes are rejected.');
            }
            $operation['validation'][] = ['name' => 'stage-integration', 'ok' => true, 'result' => $result];
        } elseif ($requiresExecution) {
            throw new RuntimeException('No isolated integration runner configured; executable extensions remain blocked.');
        }
        foreach ($operation['packages'] as $id => $package) {
            if ($this->packageDigest($package['packagePath']) !== $package['packageDigest']) {
                throw new RuntimeException("Frozen package changed during staging: {$id}");
            }
        }
        if (Files::inventory($stageRoot) !== $composed['inventory']) {
            throw new RuntimeException('Stage differs from its declared actual-change ledger.');
        }
        $this->saveOperation($operation);
        return $composed;
    }

    private function syntax(string $root, array $inventory, array $baselineInventory): array
    {
        $checked = 0;
        $unchanged = 0;
        foreach ($inventory as $path => $hash) {
            if (!preg_match('/\.(?:php|phtml)$/i', $path)) {
                continue;
            }
            if (isset($baselineInventory[$path]) && hash_equals($baselineInventory[$path], $hash)) {
                // Immutable baseline bytes were verified by Composer. Existing unused
                // vendor defects must not bypass checks for any new or modified PHP.
                ++$unchanged;
                continue;
            }
            $pipes = [];
            $process = proc_open([PHP_BINARY, '-n', '-l', Files::path($root, $path)], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root, ['PATH' => dirname(PHP_BINARY)]);
            if (!is_resource($process)) {
                throw new RuntimeException('PHP syntax checker could not start.');
            }
            fclose($pipes[0]);
            $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            $code = proc_close($process);
            if ($code !== 0) {
                throw new RuntimeException("PHP syntax validation failed in {$path}: " . trim($output));
            }
            ++$checked;
        }
        return ['checkedFiles' => $checked, 'unchangedBaselineFiles' => $unchanged];
    }

    private function currentHost(array $baselineHost): array
    {
        $baselineHost['php'] = PHP_VERSION;
        $baselineHost['manager'] = defined('ADDON_MANAGER_VERSION') ? (string) ADDON_MANAGER_VERSION : '2.0.0';
        return $baselineHost;
    }

    private function buildPlan(array $before, array $after): array
    {
        $outputs = [];
        foreach ([$before, $after] as $addons) {
            foreach ($addons as $addon) {
                if ($addon['enabled'] && ($addon['manifest']['build']['mode'] ?? 'none') === 'panel') {
                    foreach ($addon['manifest']['build']['outputs'] as $output) {
                        $outputs[$output] = true;
                    }
                }
            }
        }
        $paths = array_keys($outputs);
        sort($paths, SORT_STRING);
        return ['required' => $paths !== [], 'profile' => 'panel-v1', 'outputs' => $paths];
    }

    private function hasMigrations(array $manifests): bool
    {
        foreach ($manifests as $manifest) {
            if ($manifest['database']['migrations'] !== []) {
                return true;
            }
        }
        return false;
    }

    private function verifiedDatabaseBackup(mixed $backup): array
    {
        if (!is_array($backup) || !isset($backup['path'], $backup['sha256'], $backup['bytes'], $backup['strategy']) || !is_string($backup['path']) || !is_string($backup['sha256']) || !preg_match('/^[a-f0-9]{64}$/D', $backup['sha256']) || !is_int($backup['bytes']) || $backup['bytes'] < 1 || !is_string($backup['strategy']) || $backup['strategy'] === '') {
            throw new RuntimeException('Database snapshot adapter did not return a verifiable recovery receipt; no schema changes were attempted.');
        }
        Files::noLinks($backup['path']);
        $path = realpath($backup['path']);
        if ($path === false || !str_starts_with($path, $this->stateRoot . '/database-backups/') || !is_file($path) || Files::hash($path) !== $backup['sha256'] || filesize($path) !== $backup['bytes']) {
            throw new RuntimeException('Private database snapshot is missing, outside its controlled store, or altered; no schema changes were attempted.');
        }
        $backup['path'] = $path;
        $backup['verified'] = true;
        return $backup;
    }

    private function handleFailure(array &$operation, ?array $journal): void
    {
        $operation['status'] = 'failed';
        if ($journal !== null) {
            try {
                if ($journal['maintenanceEntered']) {
                    $this->callback('beforeRollback', [$operation]);
                }
                $this->activator->rollback($journal, $operation);
                if (($journal['database']['compatibleRollback'] ?? false) !== true) {
                    throw new RuntimeException('Files restored, but database execution may have committed. Keep maintenance enabled and reconcile migration history/backup.');
                }
                $this->assertLiveInventory($journal['beforeRegistry']['activeInventory']);
                if ($journal['maintenanceEntered']) {
                    $this->callback('afterRollback', [$operation]);
                }
                $journal['status'] = 'rolled-back';
                $this->activator->save($journal);
            } catch (Throwable $recoveryError) {
                $operation['status'] = 'recovery_required';
                $operation['recoveryError'] = $recoveryError->getMessage();
                $journal['status'] = 'recovery-required';
                $this->activator->save($journal);
            }
        }
        $this->progress($operation, $operation['status'] === 'recovery_required' ? 'recovery' : 'failed', 100, $operation['error']);
    }

    private function callback(string $name, array $arguments): mixed
    {
        if (!isset($this->config[$name])) {
            return null;
        }
        if (!is_callable($this->config[$name])) {
            throw new RuntimeException("Invalid host callback: {$name}");
        }
        $result = ($this->config[$name])(...$arguments);
        if ($result === false || (is_array($result) && isset($result['ok']) && $result['ok'] === false)) {
            throw new RuntimeException("Host {$name} check failed.");
        }
        return $result;
    }

    /** Audit mirrors observe terminal facts; their failure never reverses a verified deployment. */
    private function observeOperation(array &$operation): void
    {
        if (!isset($this->config['afterOperation'])) {
            return;
        }
        try {
            $this->callback('afterOperation', [$this->registry(), $operation]);
        } catch (Throwable $error) {
            $operation['warnings'][] = 'Terminal audit synchronization failed: ' . $error->getMessage();
            $this->saveOperation($operation);
        }
    }

    private function liveInventory(): array
    {
        $exclude = ['.git', '.github', '.agents', '.codex', 'vendor', 'node_modules', 'storage', 'bootstrap/cache', 'public/storage', 'public/addon-manager', 'addon-manager', 'addons', 'arix'];
        if (str_starts_with($this->stateRoot, $this->panelRoot . '/')) {
            $exclude[] = substr($this->stateRoot, strlen($this->panelRoot) + 1);
        }
        return Files::inventory($this->panelRoot, array_merge($exclude, $this->config['baselineExclude'] ?? []), true);
    }

    private function assertLiveInventory(array $expected): void
    {
        $actual = $this->liveInventory();
        if ($actual !== $expected) {
            $changed = [];
            foreach (array_unique([...array_keys($expected), ...array_keys($actual)]) as $path) {
                if (($expected[$path] ?? null) !== ($actual[$path] ?? null)) {
                    $changed[] = $path;
                }
            }
            throw new RuntimeException('Live source drift blocks reconstruction: ' . implode(', ', array_slice($changed, 0, 20)) . (count($changed) > 20 ? ' …' : '') . '. Use a verified baseline maintenance/rebase workflow.');
        }
    }

    private function assertNoRecovery(bool $allowActiveWorker = false): void
    {
        foreach ($this->operations() as $operation) {
            if (in_array($operation['status'], ['running', 'recovery_required'], true)) {
                if ($allowActiveWorker && $operation['status'] === 'running') {
                    $lock = Files::lock($this->stateRoot . '/deployment.lock', false);
                    if ($lock === null) {
                        continue;
                    }
                    fclose($lock);
                }
                throw new RuntimeException("Operation {$operation['id']} requires standalone recovery before another deployment.");
            }
        }
    }

    private function operations(): array
    {
        $paths = glob($this->stateRoot . '/operations/*.json') ?: [];
        sort($paths, SORT_STRING);
        $operations = [];
        foreach ($paths as $path) {
            $operations[] = Files::json($path);
        }
        usort($operations, static fn (array $left, array $right): int => [$left['sequence'] ?? 0, $left['createdAt'], $left['id']] <=> [$right['sequence'] ?? 0, $right['createdAt'], $right['id']]);
        return $operations;
    }

    private function progress(array &$operation, string $phase, int $progress, string $message): void
    {
        $operation['phase'] = $phase;
        $operation['progress'] = $progress;
        $operation['message'] = $message;
        $operation['updatedAt'] = gmdate(DATE_ATOM);
        $operation['logs'][] = ['time' => $operation['updatedAt'], 'phase' => $phase, 'message' => $message];
        $this->saveOperation($operation);
    }

    private function saveOperation(array $operation): void
    {
        Files::writeJson($this->operationPath($operation['id']), $operation);
    }

    private function operationPath(string $id): string
    {
        if (!preg_match('/^[0-9]{14}-[a-f0-9]{24}$/D', $id)) {
            throw new RuntimeException('Invalid operation ID.');
        }
        return $this->stateRoot . '/operations/' . $id . '.json';
    }

    private function rejectPublicState(string $state): void
    {
        if (preg_match('#(?:^|/)\.\.(?:/|$)#', $state)) {
            throw new RuntimeException('Private state path cannot contain traversal segments.');
        }
        foreach ([$this->panelRoot . '/public', $this->panelRoot . '/storage/app/public'] as $public) {
            if ($state === $public || str_starts_with($state, $public . '/')) {
                throw new RuntimeException('Manager state must be outside all publicly served directories.');
            }
        }
    }
}
