<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Installer;

use RuntimeException;

final class SourceProfile
{
    public const BOOTSTRAP_BLOCK = "// BEGIN KONNECT ADDON MANAGER\nrequire_once \$app->basePath('konnect-addon-manager/bootstrap.php');\n\$app->register(\\Konnect\\AddonManager\\Laravel\\AddonManagerServiceProvider::class);\n// END KONNECT ADDON MANAGER\n\n";
    public const NAV_BLOCK = "                        {{-- BEGIN KONNECT ADDON MANAGER --}}\n                        @includeIf('konnect-addons::navigation')\n                        {{-- END KONNECT ADDON MANAGER --}}\n";

    public function __construct(private readonly ?string $profileFile = null)
    {
    }

    public function detect(string $panelRoot): array
    {
        $path = $this->profileFile ?? dirname(__DIR__, 2) . '/adapters/panel-1.15.1.json';
        $document = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        $mismatches = [];
        $stateRoot = rtrim($panelRoot, '/') . '/storage/app/konnect-addon-manager';
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
                        if (realpath($registry['baselineRoot']) !== realpath($expectedRoot)) {
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
                $profile['host']['manager'] = KONNECT_ADDON_MANAGER_VERSION;
                return $profile;
            }
            $mismatches[$profile['id']] = $errors;
        }
        throw new RuntimeException('No tested source adapter matches deployed Panel files. Changes were not applied. Fingerprint report: ' . json_encode($mismatches, JSON_UNESCAPED_SLASHES));
    }

    public function originalBytes(string $relative, string $bytes): string
    {
        $block = match ($relative) {
            'bootstrap/app.php' => self::BOOTSTRAP_BLOCK,
            'resources/views/layouts/admin.blade.php' => self::NAV_BLOCK,
            default => null,
        };
        if ($block === null) {
            return $bytes;
        }
        if (str_contains($bytes, 'BEGIN KONNECT ADDON MANAGER') || str_contains($bytes, 'END KONNECT ADDON MANAGER')) {
            if (substr_count($bytes, $block) !== 1 || substr_count($bytes, 'BEGIN KONNECT ADDON MANAGER') !== 1 || substr_count($bytes, 'END KONNECT ADDON MANAGER') !== 1) {
                throw new RuntimeException('Manager registration markers are modified or duplicated: ' . $relative);
            }
            return str_replace($block, '', $bytes);
        }
        return $bytes;
    }

    public function assertNoSymlinks(string $root, string $relative): void
    {
        $path = rtrim($root, '/');
        foreach (explode('/', $relative) as $part) {
            $path .= '/' . $part;
            if (is_link($path)) {
                throw new RuntimeException('Symlink is not supported in a bootstrap integration path: ' . $relative);
            }
        }
    }
}
