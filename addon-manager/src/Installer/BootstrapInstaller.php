<?php

declare(strict_types=1);

namespace AddonManager\Installer;

use RuntimeException;
use Throwable;

final class BootstrapInstaller
{
    private readonly string $managerRoot;
    private readonly string $stateRoot;

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
                $needle = 'return $app;';
                if (substr_count($original, $needle) !== 1) {
                    throw new RuntimeException('Bootstrap return anchor is not unique.');
                }
                $modified = str_replace($needle, SourceProfile::BOOTSTRAP_BLOCK . $needle, $original);
            } else {
                $needle = "                    </ul>\n                </section>\n            </aside>";
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
        $plan = $this->plan();
        $backupRoot = $this->stateRoot . '/installer-backups';
        $this->mkdir($backupRoot);
        $lock = fopen($backupRoot . '/install.lock', 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
            throw new RuntimeException('Another initial installer is running.');
        }
        $applied = [];
        $backups = [];
        try {
            // Re-read under lock so two installers cannot duplicate the registration.
            $plan = $this->plan();
            foreach ($plan['changes'] as $relative => $change) {
                $destination = $this->panelRoot . '/' . $relative;
                if (hash_file('sha256', $destination) !== $change['beforeSha256']) {
                    throw new RuntimeException('Source changed during installation: ' . $relative);
                }
                $backup = $backupRoot . '/' . $change['beforeSha256'] . '.blob';
                if (!is_file($backup)) {
                    $this->atomicWrite($backup, $change['before'], 0600);
                }
                $backups[$relative] = ['backup' => $backup, 'beforeSha256' => $change['beforeSha256'], 'afterSha256' => $change['afterSha256']];
            }
            $record = ['schemaVersion' => 1, 'profile' => $plan['profile']['id'], 'files' => $backups, 'status' => 'prepared', 'at' => gmdate('c')];
            if ($backups !== []) {
                $this->atomicWrite($backupRoot . '/registration.json', json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n", 0600);
            }
            foreach ($plan['changes'] as $relative => $change) {
                $destination = $this->panelRoot . '/' . $relative;
                $this->atomicWrite($destination, $change['after'], fileperms($destination) & 0777);
                $applied[] = $relative;
            }
            if ($backups !== []) {
                $record['status'] = 'applied';
                $this->atomicWrite($backupRoot . '/registration.json', json_encode($record, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n", 0600);
            }
            return ['profile' => $plan['profile'], 'changed' => $applied, 'backups' => $backups];
        } catch (Throwable $e) {
            foreach (array_reverse($applied) as $relative) {
                $destination = $this->panelRoot . '/' . $relative;
                $this->atomicWrite($destination, $plan['changes'][$relative]['before'], fileperms($destination) & 0777);
            }
            throw $e;
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }

    public function restore(): array
    {
        $recordPath = $this->stateRoot . '/installer-backups/registration.json';
        if (!is_file($recordPath)) {
            return ['restored' => []];
        }
        $record = json_decode((string) file_get_contents($recordPath), true, 512, JSON_THROW_ON_ERROR);
        $prepared = [];
        foreach ($record['files'] as $relative => $entry) {
            if (!in_array($relative, ['bootstrap/app.php', 'resources/views/layouts/admin.blade.php'], true) || !preg_match('/^[a-f0-9]{64}$/D', $entry['beforeSha256'] ?? '') || !preg_match('/^[a-f0-9]{64}$/D', $entry['afterSha256'] ?? '') || ($entry['backup'] ?? null) !== $this->stateRoot . '/installer-backups/' . $entry['beforeSha256'] . '.blob') {
                throw new RuntimeException('Unexpected bootstrap backup recovery record.');
            }
            (new SourceProfile())->assertNoSymlinks($this->panelRoot, $relative);
            (new SourceProfile())->assertNoSymlinks($this->stateRoot, 'installer-backups/' . $entry['beforeSha256'] . '.blob');
            $destination = $this->panelRoot . '/' . $relative;
            $actual = hash_file('sha256', $destination);
            if ($actual === $entry['beforeSha256']) {
                continue;
            }
            if ($actual !== $entry['afterSha256'] || hash_file('sha256', $entry['backup']) !== $entry['beforeSha256']) {
                throw new RuntimeException('Refusing to overwrite unexpected bootstrap edits while recovering: ' . $relative);
            }
            $prepared[$relative] = $entry;
        }
        $restored = [];
        foreach ($prepared as $relative => $entry) {
            $destination = $this->panelRoot . '/' . $relative;
            $this->atomicWrite($destination, (string) file_get_contents($entry['backup']), fileperms($destination) & 0777);
            $restored[] = $relative;
        }
        return ['restored' => $restored];
    }

    private function mkdir(string $path): void
    {
        if (!is_dir($path) && !mkdir($path, 0700, true) && !is_dir($path)) {
            throw new RuntimeException('Cannot create private installer state: ' . $path);
        }
    }

    private function atomicWrite(string $path, string $bytes, int $mode): void
    {
        $temporary = $path . '.addon-manager-' . bin2hex(random_bytes(8));
        $handle = fopen($temporary, 'xb');
        if (!$handle) {
            throw new RuntimeException('Cannot prepare file: ' . $path);
        }
        try {
            $offset = 0;
            while ($offset < strlen($bytes)) {
                $written = fwrite($handle, substr($bytes, $offset));
                if ($written === false || $written === 0) {
                    throw new RuntimeException('Cannot write file: ' . $path);
                }
                $offset += $written;
            }
            fflush($handle);
            if (function_exists('fsync')) {
                fsync($handle);
            }
            chmod($temporary, $mode);
        } finally {
            fclose($handle);
        }
        if (!rename($temporary, $path)) {
            @unlink($temporary);
            throw new RuntimeException('Cannot activate file: ' . $path);
        }
    }
}
