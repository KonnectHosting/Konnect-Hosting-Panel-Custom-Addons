<?php

declare(strict_types=1);

namespace AddonManager\Installer;

use AddonManager\Storage\Files;
use RuntimeException;
use Throwable;

final class BootstrapInstaller
{
    private readonly string $managerRoot;
    private readonly string $stateRoot;
    private $heldLock = null;

    public function __construct(private readonly string $panelRoot, ?string $managerRoot = null, ?string $stateRoot = null)
    {
        $this->managerRoot = $managerRoot ?? dirname(__DIR__, 2);
        $this->stateRoot = $stateRoot ?? $panelRoot . '/storage/app/addon-manager';
    }

    public function plan(): array
    {
        $profile = (new SourceProfile($this->managerRoot . '/adapters/panel-1.15.1.json'))->detect($this->panelRoot);
        $changes = [];
        foreach (['bootstrap/app.php', 'resources/views/layouts/admin.blade.php'] as $relative) {
            $original = (string) file_get_contents($this->panelRoot . '/' . $relative);
            if (str_contains($original, 'BEGIN ADDON MANAGER')) {
                continue;
            }
            if ($relative === 'bootstrap/app.php') {
                $needle = SourceProfile::BOOTSTRAP_ANCHOR;
                if (substr_count($original, $needle) !== 1) {
                    throw new RuntimeException('Bootstrap return anchor is not unique.');
                }
                $modified = str_replace($needle, SourceProfile::BOOTSTRAP_BLOCK . $needle, $original);
            } else {
                $needle = SourceProfile::NAV_ANCHOR;
                if (substr_count($original, $needle) !== 1) {
                    throw new RuntimeException('Admin sidebar anchor is not unique.');
                }
                $modified = str_replace($needle, SourceProfile::NAV_BLOCK . $needle, $original);
            }
            $changes[$relative] = ['beforeSha256' => hash('sha256', $original), 'afterSha256' => hash('sha256', $modified), 'before' => $original, 'after' => $modified];
        }
        return ['profile' => $profile, 'changes' => $changes];
    }

    public function apply(): array
    {
        // Reject unsupported/legacy source before creating installer state.
        $this->plan();
        return $this->synchronized(fn (): array => $this->applyLocked());
    }

    /** Keep settings, bootstrap, readiness and recovery within one installer lock. */
    public function synchronized(callable $action): mixed
    {
        if (is_resource($this->heldLock)) return $action();
        $deployment = null;
        Files::noLinks($this->stateRoot . '/registry.json');
        // A repeated install/recovery must not overlap a source deployment.
        // Initial installation has no registry and initializes it under the
        // manager's own deployment lock, so that case must not lock it twice.
        if (is_file($this->stateRoot . '/registry.json')) {
            $deployment = Files::lock($this->stateRoot . '/deployment.lock', false);
            if ($deployment === null) {
                throw new RuntimeException('A manager deployment is running. Wait before installing or recovering bootstrap.');
            }
        }
        try {
            $this->heldLock = $this->lock();
            try {
                return $action();
            } finally {
                flock($this->heldLock, LOCK_UN);
                fclose($this->heldLock);
                $this->heldLock = null;
            }
        } finally {
            if (is_resource($deployment)) {
                flock($deployment, LOCK_UN);
                fclose($deployment);
            }
        }
    }

    private function applyLocked(): array
    {
        $backupRoot = $this->stateRoot . '/installer-backups';
        $applied = [];
        $backups = [];
        try {
            // Re-read under lock so two installers cannot duplicate the registration.
            $plan = $this->plan();
            $previous = $this->record();
            $backups = $previous['files'] ?? [];
            foreach ($backups as $entry) {
                if (Files::hash($entry['backup']) !== $entry['beforeSha256']) {
                    throw new RuntimeException('Bootstrap backup is missing or modified.');
                }
            }
            foreach ($plan['changes'] as $relative => $change) {
                $destination = $this->panelRoot . '/' . $relative;
                if (hash_file('sha256', $destination) !== $change['beforeSha256']) {
                    throw new RuntimeException('Source changed during installation: ' . $relative);
                }
                $backup = $backupRoot . '/' . $change['beforeSha256'] . '.blob';
                $backupHash = Files::hash($backup);
                if ($backupHash === null) {
                    $this->atomicWrite($backup, $change['before'], 0600);
                } elseif ($backupHash !== $change['beforeSha256']) {
                    throw new RuntimeException('Bootstrap backup is modified: ' . $relative);
                }
                $backups[$relative] = ['backup' => $backup, 'beforeSha256' => $change['beforeSha256'], 'afterSha256' => $change['afterSha256']];
            }
            $record = ['schemaVersion' => 1, 'profile' => $plan['profile']['id'], 'files' => $backups, 'status' => 'prepared', 'at' => gmdate('c')];
            if ($plan['changes'] !== []) {
                $this->atomicWrite($backupRoot . '/registration.json', json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n", 0600);
            }
            foreach ($plan['changes'] as $relative => $change) {
                $destination = $this->panelRoot . '/' . $relative;
                $this->atomicWrite($destination, $change['after'], fileperms($destination) & 0777, $change['beforeSha256']);
                $applied[] = $relative;
            }
            if ($plan['changes'] !== []) {
                $record['status'] = 'applied';
                $this->atomicWrite($backupRoot . '/registration.json', json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n", 0600);
            }
            return ['profile' => $plan['profile'], 'changed' => $applied, 'backups' => $backups];
        } catch (Throwable $e) {
            foreach (array_reverse($applied) as $relative) {
                $destination = $this->panelRoot . '/' . $relative;
                $this->atomicWrite($destination, $plan['changes'][$relative]['before'], fileperms($destination) & 0777, $plan['changes'][$relative]['afterSha256']);
            }
            throw $e;
        }
    }

    public function restore(?array $only = null): array
    {
        $recordPath = $this->stateRoot . '/installer-backups/registration.json';
        Files::noLinks($recordPath);
        if (!is_file($recordPath)) {
            return ['restored' => []];
        }
        if ($only !== null && array_diff($only, ['bootstrap/app.php', 'resources/views/layouts/admin.blade.php']) !== []) {
            throw new RuntimeException('Unexpected bootstrap recovery selection.');
        }
        return $this->synchronized(fn (): array => $this->restoreLocked($only));
    }

    private function restoreLocked(?array $only): array
    {
        $record = $this->record();
        if ($record === null) return ['restored' => []];
        $prepared = [];
        foreach ($record['files'] as $relative => $entry) {
            if ($only !== null && !in_array($relative, $only, true)) continue;
            (new SourceProfile())->assertNoSymlinks($this->panelRoot, $relative);
            (new SourceProfile())->assertNoSymlinks($this->stateRoot, 'installer-backups/' . $entry['beforeSha256'] . '.blob');
            $destination = $this->panelRoot . '/' . $relative;
            $actual = hash_file('sha256', $destination);
            if ($actual === $entry['beforeSha256']) {
                continue;
            }
            $bytes = Files::read($entry['backup']);
            if ($actual !== $entry['afterSha256'] || hash('sha256', $bytes) !== $entry['beforeSha256']) {
                throw new RuntimeException('Refusing to overwrite unexpected bootstrap edits while recovering: ' . $relative);
            }
            $prepared[$relative] = $entry + ['bytes' => $bytes];
        }
        $restored = [];
        foreach ($prepared as $relative => $entry) {
            $destination = $this->panelRoot . '/' . $relative;
            $this->atomicWrite($destination, $entry['bytes'], fileperms($destination) & 0777, $entry['afterSha256']);
            $restored[] = $relative;
        }
        return ['restored' => $restored];
    }

    private function lock()
    {
        $lock = Files::lock($this->stateRoot . '/installer-backups/install.lock', false);
        if ($lock === null) {
            throw new RuntimeException('Another bootstrap installer or recovery is running.');
        }
        return $lock;
    }

    private function record(): ?array
    {
        $path = $this->stateRoot . '/installer-backups/registration.json';
        Files::noLinks($path);
        if (!file_exists($path)) return null;
        $record = Files::json($path);
        if (($record['schemaVersion'] ?? null) !== 1 || !is_string($record['profile'] ?? null) || !is_array($record['files'] ?? null) || !in_array($record['status'] ?? null, ['prepared', 'applied'], true)) {
            throw new RuntimeException('Unexpected bootstrap backup recovery record.');
        }
        foreach ($record['files'] as $relative => $entry) {
            if (!in_array($relative, ['bootstrap/app.php', 'resources/views/layouts/admin.blade.php'], true) || !is_array($entry) || array_diff(array_keys($entry), ['backup', 'beforeSha256', 'afterSha256']) !== [] || !is_string($entry['beforeSha256'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $entry['beforeSha256']) || !is_string($entry['afterSha256'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $entry['afterSha256']) || ($entry['backup'] ?? null) !== $this->stateRoot . '/installer-backups/' . $entry['beforeSha256'] . '.blob') {
                throw new RuntimeException('Unexpected bootstrap backup recovery record.');
            }
            Files::noLinks($entry['backup']);
        }
        return $record;
    }

    private function atomicWrite(string $path, string $bytes, int $mode, ?string $expected = null): void
    {
        Files::atomic($path, $bytes, $mode, null, $expected === null ? null : static function () use ($path, $expected): void {
            if (Files::hash($path) !== $expected) {
                throw new RuntimeException('Source changed during bootstrap update: ' . $path);
            }
        });
    }
}
