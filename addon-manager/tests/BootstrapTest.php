<?php
declare(strict_types=1);

use AddonManager\Installer\BootstrapInstaller;
use AddonManager\Installer\SourceProfile;
use function AddonManager\Tests\{check, phpCommand, rejects, same, temporary, write};

$suite->test('bootstrap', 'standalone loader is repeatable and resolves neutral classes without Composer', function (): void {
    temporary(function (string $root): void {
        $script = <<<'PHP'
<?php
require __BOOTSTRAP__;
$loaders = count(spl_autoload_functions());
require __BOOTSTRAP__;
if (count(spl_autoload_functions()) !== $loaders) throw new RuntimeException('Repeated loading registered another loader');
if (ADDON_MANAGER_VERSION !== '2.0.0') throw new RuntimeException('Unexpected manager release version');
foreach ([AddonManager\Core\ManifestValidator::class, AddonManager\Installer\SourceProfile::class, AddonManager\Lifecycle\Manager::class, AddonManager\Runner\IsolatedRunner::class, AddonManager\Storage\Files::class] as $class) {
    $reflection = new ReflectionClass($class);
    if ($reflection->getName() !== $class || !str_starts_with($reflection->getFileName(), __SOURCE_ROOT__)) throw new RuntimeException('Loader resolved the wrong implementation: ' . $class);
}
foreach (['OtherVendor\\Manager', 'AddonManager\\..\\bootstrap', 'AddonManager\\MissingClass'] as $class) {
    if (class_exists($class)) throw new RuntimeException('Loader resolved an unsupported class: ' . $class);
}
echo 'neutral loader ready';
PHP;
        $script = str_replace(['__BOOTSTRAP__', '__SOURCE_ROOT__'], [var_export(dirname(__DIR__) . '/bootstrap.php', true), var_export(dirname(__DIR__) . '/src/', true)], $script);
        write($root . '/loader.php', $script);
        $result = phpCommand($root . '/loader.php');
        same(0, $result['exit'], $result['stderr']);
        same('', $result['stderr'], 'Standalone loading produced diagnostics');
        same('neutral loader ready', $result['stdout']);
    });
});

$adapterPath = dirname(__DIR__) . '/adapters/panel-1.15.1.json';
$profiles = json_decode(file_get_contents($adapterPath), true, 512, JSON_THROW_ON_ERROR)['profiles'];
foreach ($profiles as $profile) {
    $suite->test('bootstrap', 'initial registration is repeatable on ' . $profile['id'], function () use ($profile, $adapterPath): void {
        temporary(function (string $root) use ($profile, $adapterPath): void {
            $panel = $root . '/panel';
            foreach ($profile['fixtureSources'] as $relative => $source) write($panel . '/' . $relative, file_get_contents(dirname(__DIR__, 2) . '/' . $source));
            $original = [];
            foreach ($profile['fingerprints'] as $relative => $sha256) {
                same($sha256, hash_file('sha256', $panel . '/' . $relative), 'Fixture source is not pinned: ' . $relative);
                $original[$relative] = file_get_contents($panel . '/' . $relative);
            }
            same($profile['id'], (new SourceProfile($adapterPath))->detect($panel)['id']);
            same(ADDON_MANAGER_VERSION, (new SourceProfile($adapterPath))->detect($panel)['host']['manager']);
            $installer = new BootstrapInstaller($panel, dirname(__DIR__), $root . '/state');
            $plan = $installer->plan();
            same(2, count($plan['changes']));
            $first = $installer->apply();
            same(2, count($first['changed']));
            $installed = [];
            foreach ($original as $relative => $bytes) $installed[$relative] = file_get_contents($panel . '/' . $relative);
            foreach (['bootstrap/app.php', 'resources/views/layouts/admin.blade.php'] as $relative) {
                same(1, substr_count($installed[$relative], 'BEGIN ADDON MANAGER'), 'Duplicate registration at ' . $relative);
                check($installed[$relative] !== $original[$relative], 'Initial registration did not change the target');
            }
            check(str_contains($installed['bootstrap/app.php'], "basePath('addon-manager/bootstrap.php')"), 'Bootstrap does not load the installed manager directory');
            check(str_contains($installed['bootstrap/app.php'], '\\AddonManager\\Laravel\\AddonManagerServiceProvider::class'), 'Bootstrap does not register the neutral provider');
            check(str_contains($installed['resources/views/layouts/admin.blade.php'], "@includeIf('addon-manager::navigation')"), 'Navigation does not resolve the neutral view namespace');
            $second = $installer->apply();
            same([], $second['changed']);
            same($profile['id'], $second['profile']['id']);
            foreach ($installed as $relative => $bytes) same($bytes, file_get_contents($panel . '/' . $relative), 'Repeated bootstrap changed ' . $relative);
            foreach ($first['backups'] as $relative => $entry) same($original[$relative], file_get_contents($entry['backup']), 'Bootstrap backup contains modified bytes');
            $installer->restore();
            foreach ($original as $relative => $bytes) same($bytes, file_get_contents($panel . '/' . $relative), 'Bootstrap restore failed at ' . $relative);
        });
    });
}

$suite->test('bootstrap', 'unexpected host source fingerprints refuse registration without changes', function () use ($profiles): void {
    temporary(function (string $root) use ($profiles): void {
        $profile = $profiles[0];
        $panel = $root . '/panel';
        foreach ($profile['fixtureSources'] as $relative => $source) write($panel . '/' . $relative, file_get_contents(dirname(__DIR__, 2) . '/' . $source));
        write($panel . '/resources/views/layouts/admin.blade.php', file_get_contents($panel . '/resources/views/layouts/admin.blade.php') . "\nmanual customization\n");
        $before = hash_file('sha256', $panel . '/bootstrap/app.php');
        rejects(static fn () => (new BootstrapInstaller($panel, dirname(__DIR__), $root . '/state'))->apply(), '/fingerprint|source|profile|unsupported/i');
        same($before, hash_file('sha256', $panel . '/bootstrap/app.php'));
        check(!str_contains(file_get_contents($panel . '/resources/views/layouts/admin.blade.php'), 'BEGIN ADDON MANAGER'), 'Unsupported source was patched');
    });
});

// These fixtures preserve legacy identifiers intentionally: they represent
// existing installations that must never become a new manager baseline.
$legacyCases = [
    'private registry with clean host source' => static function (string $panel): void { write($panel . '/storage/app/konnect-addon-manager/registry.json', '{"preservedLegacyData":true}'); },
    'legacy code directory' => static function (string $panel): void { write($panel . '/konnect-addon-manager/bootstrap.php', '<?php // retained legacy code'); },
    'legacy public assets' => static function (string $panel): void { write($panel . '/public/konnect-addon-manager/build/manager.v1.js', 'retained legacy asset'); },
    'legacy manager configuration' => static function (string $panel): void { write($panel . '/config/konnect-addon-manager.php', '<?php return [];'); },
    'legacy extension configuration' => static function (string $panel): void { write($panel . '/config/konnect-addons.php', '<?php return [];'); },
    'dangling legacy artifact link' => static function (string $panel): void { check(symlink($panel . '/missing-legacy-folder', $panel . '/konnect-addon-manager'), 'Cannot construct legacy link fixture'); },
    'legacy bootstrap hook without state' => static function (string $panel): void { write($panel . '/bootstrap/app.php', file_get_contents($panel . '/bootstrap/app.php') . "\n// BEGIN KONNECT ADDON MANAGER\n"); },
    'legacy provider without markers or state' => static function (string $panel): void { write($panel . '/bootstrap/app.php', file_get_contents($panel . '/bootstrap/app.php') . "\n// \\Konnect\\AddonManager\\Laravel\\AddonManagerServiceProvider::class\n"); },
    'legacy navigation without state' => static function (string $panel): void { write($panel . '/resources/views/layouts/admin.blade.php', file_get_contents($panel . '/resources/views/layouts/admin.blade.php') . "\n@includeIf('konnect-addons::navigation')\n"); },
    'mixed neutral and legacy hooks' => static function (string $panel): void { write($panel . '/bootstrap/app.php', str_replace('return $app;', SourceProfile::BOOTSTRAP_BLOCK . "// END KONNECT ADDON MANAGER\nreturn \$app;", file_get_contents($panel . '/bootstrap/app.php'))); },
    'legacy Composer namespace registration' => static function (string $panel): void { write($panel . '/composer.json', json_encode(['autoload' => ['psr-4' => ['Konnect\\AddonManager\\' => 'custom-loader/']]], JSON_THROW_ON_ERROR)); },
    'copied registry referring to a legacy baseline' => static function (string $panel): void { write($panel . '/storage/app/addon-manager/registry.json', json_encode(['baselineRoot' => $panel . '/storage/app/konnect-addon-manager/baselines/old/files'], JSON_THROW_ON_ERROR)); },
    'copied host settings referring to legacy state' => static function (string $panel): void { write($panel . '/storage/app/addon-manager/host.json', json_encode(['stateRoot' => $panel . '/storage/app/konnect-addon-manager'], JSON_THROW_ON_ERROR)); },
    'copied bootstrap recovery record referring to legacy backups' => static function (string $panel): void { write($panel . '/storage/app/addon-manager/installer-backups/registration.json', json_encode(['backup' => $panel . '/storage/app/konnect-addon-manager/installer-backups/original.blob'], JSON_THROW_ON_ERROR)); },
];
foreach ($legacyCases as $name => $prepare) {
    $suite->test('bootstrap', 'legacy installation refuses adoption before writes: ' . $name, function () use ($profiles, $adapterPath, $prepare): void {
        temporary(function (string $root) use ($profiles, $adapterPath, $prepare): void {
            $panel = $root . '/panel';
            foreach ($profiles[0]['fixtureSources'] as $relative => $source) write($panel . '/' . $relative, file_get_contents(dirname(__DIR__, 2) . '/' . $source));
            $prepare($panel);
            $before = [];
            foreach (['bootstrap/app.php', 'resources/views/layouts/admin.blade.php', 'storage/app/addon-manager/registry.json', 'storage/app/addon-manager/host.json', 'storage/app/addon-manager/installer-backups/registration.json', 'storage/app/konnect-addon-manager/registry.json'] as $relative) {
                $before[$relative] = is_file($panel . '/' . $relative) ? file_get_contents($panel . '/' . $relative) : null;
            }
            $stateExisted = is_dir($panel . '/storage/app/addon-manager');
            $backupsExisted = is_dir($panel . '/storage/app/addon-manager/installer-backups');
            $reason = '/Legacy branded manager installation detected.*addon-manager\/docs\/UPGRADING\.md/s';
            rejects(static fn () => (new SourceProfile($adapterPath))->detect($panel), $reason);
            rejects(static fn () => (new BootstrapInstaller($panel, dirname(__DIR__)))->apply(), $reason);
            foreach ($before as $relative => $bytes) same($bytes, is_file($panel . '/' . $relative) ? file_get_contents($panel . '/' . $relative) : null, 'Legacy rejection changed ' . $relative);
            same($stateExisted, is_dir($panel . '/storage/app/addon-manager'), 'Legacy rejection created neutral manager state');
            same($backupsExisted, is_dir($panel . '/storage/app/addon-manager/installer-backups'), 'Legacy rejection prepared new bootstrap backups');
        });
    });
}

$suite->test('bootstrap', 'retained legacy bootstrap cannot be normalized into a fresh source profile', function (): void {
    $legacy = "// BEGIN KONNECT ADDON MANAGER\nrequire_once 'konnect-addon-manager/bootstrap.php';\n// END KONNECT ADDON MANAGER\n";
    foreach (['bootstrap/app.php', 'resources/views/layouts/admin.blade.php'] as $relative) {
        rejects(static fn () => (new SourceProfile())->originalBytes($relative, $legacy), '/Legacy branded manager installation detected/i');
    }
});
