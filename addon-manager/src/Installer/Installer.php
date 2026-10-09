<?php

declare(strict_types=1);

namespace AddonManager\Installer;

use AddonManager\Laravel\HostAdapter;
use AddonManager\Storage\Files;
use RuntimeException;
use Throwable;

final class Installer
{
    private readonly string $managerRoot;

    public function __construct(private readonly string $panelRoot, ?string $managerRoot = null)
    {
        $this->managerRoot = $managerRoot ?? dirname(__DIR__, 2);
    }

    public function run(bool $dryRun = false, array $configuration = []): array
    {
        if (PHP_VERSION_ID < 80200) {
            throw new RuntimeException('The manager requires PHP 8.2 or newer.');
        }
        if (realpath($this->panelRoot . '/addon-manager') !== realpath($this->managerRoot)) {
            throw new RuntimeException('Place the complete addon-manager folder directly inside the selected Panel root.');
        }
        $unknown = array_diff(array_keys($configuration), ['runner', 'worker', 'workerControl']);
        if ($unknown !== []) {
            throw new RuntimeException('Unknown host configuration fields: ' . implode(', ', $unknown));
        }
        $bootstrap = new BootstrapInstaller($this->panelRoot, $this->managerRoot);
        $plan = $bootstrap->plan();
        $host = HostAdapter::boot($this->panelRoot);
        $stateRoot = $host->stateRoot;
        $this->validatePrivateState($stateRoot);
        $settingsFile = $stateRoot . '/host.json';
        Files::noLinks($settingsFile);
        $existing = is_file($settingsFile) ? Files::json($settingsFile) : [];
        $settings = array_replace($existing, $configuration, ['schemaVersion' => 1, 'profile' => $plan['profile']['id'], 'host' => $plan['profile']['host'], 'baselineOwners' => $plan['profile']['baselineOwners'], 'baselineWarnings' => $plan['profile']['baselineWarnings'] ?? []]);
        $preflight = (new HostAdapter($host->application(), $settings))->doctor();
        $report = ['success' => false, 'dryRun' => $dryRun, 'profile' => $plan['profile']['id'], 'host' => $plan['profile']['host'], 'warnings' => $settings['baselineWarnings'], 'preflight' => $preflight, 'changes' => array_keys($plan['changes']), 'managerUrl' => '/admin/addon-manager'];
        if (!$preflight['hostReady']) {
            $report['message'] = 'Restore the failed Panel prerequisites before initial installation. No bootstrap or navigation changes were applied.';
            return $report;
        }
        if ($dryRun) {
            $stateChecks = $this->existingStateChecks(new HostAdapter($host->application(), $settings), $plan['changes']);
            if ($stateChecks !== null) {
                $report['managerDoctor'] = $stateChecks;
                if (!$stateChecks['ok']) {
                    $report['message'] = $this->stateFailure($stateChecks);
                    return $report;
                }
            }
            $report['success'] = true;
            return $report;
        }
        return $bootstrap->synchronized(function () use ($bootstrap, $host, $stateRoot, $settingsFile, $configuration, $plan, $report): array {
            $plan = $bootstrap->plan();
            $existing = is_file($settingsFile) ? Files::json($settingsFile) : [];
            $settings = array_replace($existing, $configuration, ['schemaVersion' => 1, 'profile' => $plan['profile']['id'], 'host' => $plan['profile']['host'], 'baselineOwners' => $plan['profile']['baselineOwners'], 'baselineWarnings' => $plan['profile']['baselineWarnings'] ?? []]);
            $configuredHost = new HostAdapter($host->application(), $settings);
            $stateChecks = $this->existingStateChecks($configuredHost, $plan['changes']);
            if ($stateChecks !== null && !$stateChecks['ok']) {
                throw new RuntimeException($this->stateFailure($stateChecks));
            }
            $this->ensurePrivateState($stateRoot);
            $this->saveSettings($settingsFile, $settings);
            $result = $bootstrap->apply();
            try {
                $report['createdTables'] = $host->installTables();
                $report['assets'] = $this->deployAssets();
                $host->clearCaches();
                $readiness = $host->readiness();
                if (!$readiness['ready']) {
                    throw new RuntimeException($readiness['message']);
                }
                $report['readiness'] = $readiness;
                $manager = $configuredHost->manager();
                if (!is_file($stateRoot . '/registry.json')) {
                    $report['baseline'] = $manager->initialize($plan['profile']['host']);
                }
                $report['managerDoctor'] = $manager->doctor();
                if (!$report['managerDoctor']['ok']) {
                    throw new RuntimeException($this->stateFailure($report['managerDoctor']));
                }
                $report['success'] = true;
                $report['changed'] = $result['changed'];
                $report['doctor'] = $configuredHost->doctor();
                $report['message'] = $report['doctor']['ready'] ? 'Manager installation and operation prerequisites are ready.' : 'Manager installed. Complete the management-worker and isolated-runner checks before installing addons.';
                return $report;
            } catch (Throwable $e) {
                // Only changes made by this invocation are reverted. A retry never removes
                // a registration that was already present before it started.
                if ($result['changed'] !== []) {
                    $report['rollback'] = $bootstrap->restore($result['changed']);
                }
                $host->clearCaches();
                throw new RuntimeException('Initial manager readiness failed; bootstrap changes from this invocation were restored. Manager tables/data and private diagnostics remain for a safe retry. ' . $e->getMessage(), 0, $e);
            }
        });
    }

    private function existingStateChecks(HostAdapter $host, array $changes): ?array
    {
        $registry = $host->stateRoot . '/registry.json';
        Files::noLinks($registry);
        // A fresh dry run must not create manager directories or capture a baseline.
        if (!is_file($registry)) return null;
        $repairs = array_map(static fn (array $change): array => array_intersect_key($change, array_flip(['beforeSha256', 'afterSha256'])), $changes);
        return $host->manager()->doctor($repairs);
    }

    private function stateFailure(array $checks): string
    {
        $failed = array_filter($checks['checks'], static fn (array $check): bool => !$check['ok']);
        return 'Manager state checks failed: ' . implode('; ', array_map(static fn (array $check): string => $check['name'] . ': ' . $check['message'], $failed));
    }

    private function ensurePrivateState(string $path): void
    {
        $this->validatePrivateState($path);
        Files::directory($path);
        if (!chmod($path, 0700)) {
            throw new RuntimeException('Cannot secure private manager state.');
        }
    }

    private function validatePrivateState(string $path): void
    {
        $canonicalPanel = realpath($this->panelRoot);
        $publicStorage = $canonicalPanel . '/storage/app/public';
        if ($canonicalPanel === false || !str_starts_with($path, $canonicalPanel . '/storage/app/') || $path === $publicStorage || str_starts_with($path, $publicStorage . '/')) {
            throw new RuntimeException('Private manager state must be inside Panel storage/app and outside public storage.');
        }
        Files::relative(substr($path, strlen($canonicalPanel) + 1));
        Files::noLinks($path);
    }

    private function saveSettings(string $path, array $settings): void
    {
        $bytes = json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
        Files::atomic($path, $bytes, 0600);
    }

    private function deployAssets(): array
    {
        $source = $this->managerRoot . '/public/build';
        $destination = $this->panelRoot . '/public/addon-manager/build';
        (new SourceProfile())->assertNoSymlinks($this->panelRoot, 'public/addon-manager/build');
        Files::noLinks($source);
        if (!is_dir($source)) {
            throw new RuntimeException('The release is incomplete: prebuilt manager assets are missing.');
        }
        if (!is_dir($destination) && !mkdir($destination, 0755, true) && !is_dir($destination)) {
            throw new RuntimeException('Cannot deploy public manager assets.');
        }
        $copied = [];
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($source, \FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $file) {
            if (!$file->isFile() || $file->isLink()) {
                throw new RuntimeException('Unexpected entry in prebuilt manager assets.');
            }
            $relative = substr($file->getPathname(), strlen($source) + 1);
            if (!preg_match('/^[A-Za-z0-9_\/.\-]+\.(?:js|css|map|svg|png|woff2?)$/D', $relative) || str_contains($relative, '..')) {
                throw new RuntimeException('Unsupported public manager asset: ' . $relative);
            }
            $target = $destination . '/' . $relative;
            (new SourceProfile())->assertNoSymlinks($destination, $relative);
            if (!is_dir(dirname($target))) {
                mkdir(dirname($target), 0755, true);
            }
            if (is_file($target) && hash_file('sha256', $target) === hash_file('sha256', $file->getPathname())) {
                continue;
            }
            Files::atomic($target, Files::read($file->getPathname()), 0644);
            $copied[] = $relative;
        }
        return $copied;
    }
}
