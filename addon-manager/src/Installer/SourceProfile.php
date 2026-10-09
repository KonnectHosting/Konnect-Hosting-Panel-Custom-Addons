<?php

declare(strict_types=1);

namespace AddonManager\Installer;

use AddonManager\Storage\Files;
use RuntimeException;

final class SourceProfile
{
    public const BOOTSTRAP_BLOCK = "// BEGIN ADDON MANAGER\nrequire_once \$app->basePath('addon-manager/bootstrap.php');\n\$app->register(\\AddonManager\\Laravel\\AddonManagerServiceProvider::class);\n// END ADDON MANAGER\n\n";
    public const NAV_BLOCK = "                        {{-- BEGIN ADDON MANAGER --}}\n                        @includeIf('addon-manager::navigation')\n                        {{-- END ADDON MANAGER --}}\n";
    public const BOOTSTRAP_ANCHOR = 'return $app;';
    public const NAV_ANCHOR = "                    </ul>\n                </section>\n            </aside>";

    public function __construct(private readonly ?string $profileFile = null)
    {
    }

    public function detect(string $panelRoot): array
    {
        // Legacy state must be assessed before loading Panel or selecting a new
        // baseline, even if someone has already removed the old registration.
        $this->assertNoLegacyInstallation($panelRoot);
        $path = $this->profileFile ?? dirname(__DIR__, 2) . '/adapters/panel-1.15.1.json';
        $document = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $mismatches = [];
        $stateRoot = rtrim($panelRoot, '/') . '/storage/app/addon-manager';
        $registryFile = $stateRoot . '/registry.json';
        $registry = is_file($registryFile) ? json_decode((string) file_get_contents($registryFile), true, 512, JSON_THROW_ON_ERROR) : null;
        foreach ($document['profiles'] as $profile) {
            $errors = [];
            foreach ($profile['fingerprints'] as $relative => $expected) {
                $file = rtrim($panelRoot, '/') . '/' . $relative;
                $this->assertNoSymlinks($panelRoot, $relative);
                $bytes = is_file($file) ? file_get_contents($file) : false;
                if ($bytes !== false) {
                    $rawHash = hash('sha256', $bytes);
                    $bytes = $this->originalBytes($relative, $bytes);
                    // Repeat installation after managed source changes validates the
                    // live ledger first, then identifies the retained original profile.
                    if ($registry !== null && ($registry['activeInventory'][$relative] ?? null) === $rawHash && ($registry['baselineInventory'][$relative] ?? null) !== $rawHash) {
                        if (!preg_match('/^[a-f0-9]{64}$/D', $registry['baselineId'] ?? '')) {
                            throw new RuntimeException('Invalid retained baseline identity.');
                        }
                        $expectedRoot = $stateRoot . '/baselines/' . $registry['baselineId'] . '/files';
                        Files::noLinks($expectedRoot);
                        if (!is_string($registry['baselineRoot'] ?? null) || !is_dir($expectedRoot) || realpath($registry['baselineRoot']) !== realpath($expectedRoot)) {
                            throw new RuntimeException('Unexpected retained baseline path.');
                        }
                        $this->assertNoSymlinks($expectedRoot, $relative);
                        $baseline = $expectedRoot . '/' . $relative;
                        if (!is_file($baseline) || hash_file('sha256', $baseline) !== ($registry['baselineInventory'][$relative] ?? null)) {
                            throw new RuntimeException('Retained source profile baseline is missing or modified: ' . $relative);
                        }
                        $bytes = $this->originalBytes($relative, (string) file_get_contents($baseline));
                    }
                }
                $actual = $bytes === false ? null : hash('sha256', $bytes);
                if ($actual !== $expected) {
                    $errors[] = ['path' => $relative, 'expected' => $expected, 'actual' => $actual];
                }
            }
            // A stock profile must never conceal an active unrecognized theme or pack.
            if ($profile['host']['arix'] === null && is_file($panelRoot . '/app/Http/Controllers/Admin/Arix/ArixController.php')) {
                $errors[] = ['path' => 'app/Http/Controllers/Admin/Arix/ArixController.php', 'reason' => 'Active Arix source requires an Arix profile.'];
            }
            if ($profile['host']['addonPack'] === null && is_file($panelRoot . '/app/Services/ArixAddons/Installers/VersionCatalogService.php')) {
                $errors[] = ['path' => 'app/Services/ArixAddons/Installers/VersionCatalogService.php', 'reason' => 'Active addon-pack source requires an addon-pack profile.'];
            }
            if ($errors === []) {
                $profile['host']['php'] = PHP_VERSION;
                $profile['host']['manager'] = ADDON_MANAGER_VERSION;
                return $profile;
            }
            $mismatches[$profile['id']] = $errors;
        }
        throw new RuntimeException('No tested source adapter matches deployed Panel files. Changes were not applied. Fingerprint report: ' . json_encode($mismatches, JSON_UNESCAPED_SLASHES));
    }

    public function originalBytes(string $relative, string $bytes): string
    {
        $this->assertNoLegacyBytes($relative, $bytes);
        $block = match ($relative) {
            'bootstrap/app.php' => self::BOOTSTRAP_BLOCK,
            'resources/views/layouts/admin.blade.php' => self::NAV_BLOCK,
            default => null,
        };
        if ($block === null) {
            return $bytes;
        }
        if (str_contains($bytes, 'BEGIN ADDON MANAGER') || str_contains($bytes, 'END ADDON MANAGER')) {
            if (substr_count($bytes, $block) !== 1 || substr_count($bytes, 'BEGIN ADDON MANAGER') !== 1 || substr_count($bytes, 'END ADDON MANAGER') !== 1) {
                throw new RuntimeException('Manager registration markers are modified or duplicated: ' . $relative);
            }
            $anchor = $relative === 'bootstrap/app.php' ? self::BOOTSTRAP_ANCHOR : self::NAV_ANCHOR;
            if (substr_count($bytes, $block . $anchor) !== 1) {
                throw new RuntimeException('Manager registration is outside its supported anchor: ' . $relative);
            }
            return str_replace($block, '', $bytes);
        }
        return $bytes;
    }

    public function assertNoLegacyInstallation(string $panelRoot): void
    {
        $panelRoot = rtrim($panelRoot, '/');
        foreach (['konnect-addon-manager', 'storage/app/konnect-addon-manager', 'public/konnect-addon-manager', 'config/konnect-addon-manager.php', 'config/konnect-addons.php'] as $relative) {
            $path = $panelRoot . '/' . $relative;
            if (file_exists($path) || is_link($path)) {
                $this->rejectLegacyInstallation($relative);
            }
        }
        foreach (['bootstrap/app.php', 'resources/views/layouts/admin.blade.php', 'config/app.php', 'composer.json', 'storage/app/addon-manager/registry.json', 'storage/app/addon-manager/host.json', 'storage/app/addon-manager/installer-backups/registration.json'] as $relative) {
            $this->assertNoSymlinks($panelRoot, $relative);
            $path = $panelRoot . '/' . $relative;
            if (is_file($path)) {
                $bytes = file_get_contents($path);
                if ($bytes === false) {
                    throw new RuntimeException('Cannot inspect manager integration source: ' . $relative);
                }
                $this->assertNoLegacyBytes($relative, $bytes);
            }
        }
    }

    private function assertNoLegacyBytes(string $relative, string $bytes): void
    {
        foreach (['BEGIN KONNECT ADDON MANAGER', 'END KONNECT ADDON MANAGER', 'konnect-addon-manager', 'Konnect\\AddonManager\\', 'Konnect\\\\AddonManager\\\\', 'konnect-addons::'] as $legacy) {
            if (str_contains($bytes, $legacy)) {
                $this->rejectLegacyInstallation($relative);
            }
        }
    }

    private function rejectLegacyInstallation(string $relative): never
    {
        throw new RuntimeException('Legacy branded manager installation detected at ' . $relative . '. No installation changes were applied. Addon Manager cannot adopt or migrate its registry, managed source, or bootstrap registration. Preserve the legacy installation and follow addon-manager/docs/UPGRADING.md before installing.');
    }

    public function assertNoSymlinks(string $root, string $relative): void
    {
        Files::noLinks(rtrim($root, '/') . '/' . Files::relative($relative));
    }
}
