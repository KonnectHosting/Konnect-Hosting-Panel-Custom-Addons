<?php
declare(strict_types=1);

use AddonManager\Installer\BootstrapInstaller;
use AddonManager\Installer\Installer;
use AddonManager\Installer\SourceProfile;
use AddonManager\Laravel\HostAdapter;
use AddonManager\Lifecycle\Manager;
use AddonManager\Storage\Files;
use function AddonManager\Tests\{check, host, phpCommand, rejects, same, temporary, write};

$suite->test('bootstrap', 'standalone loader is repeatable and resolves neutral classes without Composer', function (): void {
    temporary(function (string $root): void {
        $script = <<<'PHP'
<?php
require __BOOTSTRAP__;
$loaders = count(spl_autoload_functions());
require __BOOTSTRAP__;
if (count(spl_autoload_functions()) !== $loaders) throw new RuntimeException('Repeated loading registered another loader');
if (ADDON_MANAGER_VERSION !== '2.0.1') throw new RuntimeException('Unexpected manager release version');
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

function bootstrapFixture(string $root, array $profile): BootstrapInstaller
{
    foreach ($profile['fixtureSources'] as $relative => $source) write($root . '/panel/' . $relative, file_get_contents(dirname(__DIR__, 2) . '/' . $source));
    return new BootstrapInstaller($root . '/panel', dirname(__DIR__), $root . '/state');
}

$suite->test('bootstrap', 'repair retains both original backups and failure recovery preserves existing registration', function () use ($profiles): void {
    temporary(function (string $root) use ($profiles): void {
        $installer = bootstrapFixture($root, $profiles[0]);
        $original = Files::inventory($root . '/panel');
        $first = $installer->apply();
        $bootstrap = file_get_contents($root . '/panel/bootstrap/app.php');
        $navigation = 'resources/views/layouts/admin.blade.php';
        write($root . '/panel/' . $navigation, file_get_contents($first['backups'][$navigation]['backup']));
        $repair = $installer->apply();
        same([$navigation], $repair['changed']);
        same(2, count(Files::json($root . '/state/installer-backups/registration.json')['files']), 'Repair discarded another original backup');
        same([$navigation], $installer->restore($repair['changed'])['restored']);
        same($bootstrap, file_get_contents($root . '/panel/bootstrap/app.php'), 'Repair rollback removed an existing registration');
        same(['bootstrap/app.php'], $installer->restore()['restored']);
        same($original, Files::inventory($root . '/panel'));
    });
});

$suite->test('bootstrap', 'installer and recovery respect the same exclusive lock', function () use ($profiles): void {
    temporary(function (string $root) use ($profiles): void {
        $installer = bootstrapFixture($root, $profiles[0]);
        $installer->apply();
        $before = Files::inventory($root . '/panel');
        $record = file_get_contents($root . '/state/installer-backups/registration.json');
        $lock = Files::lock($root . '/state/installer-backups/install.lock');
        try {
            rejects(static fn () => $installer->apply(), '/installer.*recovery.*running/i');
            rejects(static fn () => $installer->restore(), '/installer.*recovery.*running/i');
        } finally { fclose($lock); }
        same($before, Files::inventory($root . '/panel'));
        same($record, file_get_contents($root . '/state/installer-backups/registration.json'));
    });
});

foreach (['state', 'installer-backups', 'install.lock', 'registration.json', 'backup blob'] as $linkTarget) {
    $suite->test('bootstrap', 'state symlink refuses installer and recovery: ' . $linkTarget, function () use ($profiles, $linkTarget): void {
        temporary(function (string $root) use ($profiles, $linkTarget): void {
            $installer = bootstrapFixture($root, $profiles[0]);
            $first = $installer->apply();
            $before = Files::inventory($root . '/panel');
            $path = match ($linkTarget) {
                'state' => $root . '/state',
                'installer-backups' => $root . '/state/installer-backups',
                'backup blob' => $first['backups']['bootstrap/app.php']['backup'],
                default => $root . '/state/installer-backups/' . $linkTarget,
            };
            $outside = $root . '/preserved-' . str_replace(['.', ' '], '-', $linkTarget);
            check(rename($path, $outside), 'Cannot move original recovery fixture');
            check(symlink($outside, $path), 'Cannot prepare state symlink');
            $outsideBefore = is_dir($outside) ? Files::inventory($outside) : file_get_contents($outside);
            rejects(static fn () => $installer->apply(), '/symbolic|symlink/i');
            rejects(static fn () => $installer->restore(), '/symbolic|symlink/i');
            same($before, Files::inventory($root . '/panel'), 'Symlink rejection changed host source');
            same($outsideBefore, is_dir($outside) ? Files::inventory($outside) : file_get_contents($outside), 'Symlink rejection changed its target');
        });
    });
}

$suite->test('bootstrap', 'modified original backup blocks repeat registration before writes', function () use ($profiles): void {
    temporary(function (string $root) use ($profiles): void {
        $installer = bootstrapFixture($root, $profiles[0]);
        $first = $installer->apply();
        $before = Files::inventory($root . '/panel');
        write($first['backups']['bootstrap/app.php']['backup'], 'tampered recovery bytes');
        rejects(static fn () => $installer->apply(), '/backup.*modified/i');
        rejects(static fn () => $installer->restore(), '/unexpected bootstrap edits/i');
        same($before, Files::inventory($root . '/panel'));
    });
});

$suite->test('bootstrap', 'recovery validates every source before restoring the first registration', function () use ($profiles): void {
    temporary(function (string $root) use ($profiles): void {
        $installer = bootstrapFixture($root, $profiles[0]);
        $installer->apply();
        $path = $root . '/panel/resources/views/layouts/admin.blade.php';
        write($path, file_get_contents($path) . "\nmanual changes\n");
        $before = Files::inventory($root . '/panel');
        rejects(static fn () => $installer->restore(), '/unexpected bootstrap edits/i');
        same($before, Files::inventory($root . '/panel'));
    });
});

$suite->test('bootstrap', 'exact registration bytes outside the supported anchor refuse detection', function () use ($profiles): void {
    foreach (['bootstrap/app.php' => SourceProfile::BOOTSTRAP_BLOCK, 'resources/views/layouts/admin.blade.php' => SourceProfile::NAV_BLOCK] as $relative => $block) {
        temporary(function (string $root) use ($profiles, $relative, $block): void {
            $installer = bootstrapFixture($root, $profiles[0]);
            write($root . '/panel/' . $relative, $block . file_get_contents($root . '/panel/' . $relative));
            $before = Files::inventory($root . '/panel');
            rejects(static fn () => $installer->apply(), '/supported anchor/i');
            same($before, Files::inventory($root . '/panel'));
            check(!is_dir($root . '/state'), 'Rejected registration created installer state');
        });
    }
});

$suite->test('bootstrap', 'CLI recovery rejects dry-run instead of silently changing registered files', function () use ($profiles): void {
    temporary(function (string $root) use ($profiles): void {
        bootstrapFixture($root, $profiles[0]);
        (new BootstrapInstaller($root . '/panel', dirname(__DIR__)))->apply();
        $before = Files::inventory($root . '/panel');
        $result = phpCommand(dirname(__DIR__) . '/install.php', ['--panel-root=' . $root . '/panel', '--recover-bootstrap', '--dry-run']);
        same(1, $result['exit']);
        check(str_contains($result['stderr'], 'cannot be combined'), 'Conflicting recovery options lost their reason');
        same($before, Files::inventory($root . '/panel'));
    });
});

$suite->test('bootstrap', 'CLI host configuration requires a JSON object', function (): void {
    temporary(function (string $root): void {
        write($root . '/settings.json', '[]');
        $result = phpCommand(dirname(__DIR__) . '/install.php', ['--panel-root=' . $root, '--config=' . $root . '/settings.json', '--dry-run']);
        same(1, $result['exit']);
        check(str_contains($result['stderr'], 'must be a JSON object'), 'Array host settings were not rejected at the CLI boundary');
    });
});

$suite->test('bootstrap', 'full installation lock survives nested registration and recovery until completion', function () use ($profiles): void {
    temporary(function (string $root) use ($profiles): void {
        $installer = bootstrapFixture($root, $profiles[0]);
        $original = Files::inventory($root . '/panel');
        $other = new BootstrapInstaller($root . '/panel', dirname(__DIR__), $root . '/state');
        $installer->synchronized(function () use ($installer, $other): void {
            $first = $installer->apply();
            same(2, count($first['changed']));
            rejects(static fn () => $other->apply(), '/installer.*recovery.*running/i');
            rejects(static fn () => $other->restore(), '/installer.*recovery.*running/i');
            same(2, count($installer->restore($first['changed'])['restored']), 'Held lock deadlocked nested recovery');
            same(2, count($installer->apply()['changed']), 'Held lock deadlocked nested registration');
            rejects(static fn () => $other->apply(), '/installer.*recovery.*running/i');
        });
        same(2, count($other->restore()['restored']), 'Completed installation retained its lock');
        same($original, Files::inventory($root . '/panel'));
    });
});

$suite->test('bootstrap', 'retained source fingerprints validate composed bytes and reject linked baseline ancestors', function () use ($profiles): void {
    temporary(function (string $root) use ($profiles): void {
        bootstrapFixture($root, $profiles[0]);
        $panel = $root . '/panel';
        $baseline = Files::inventory($panel);
        $id = hash('sha256', 'retained test snapshot');
        $files = $panel . '/storage/app/addon-manager/baselines/' . $id . '/files';
        Files::copyInventory($panel, $files, $baseline);
        $target = 'resources/scripts/routers/routes.ts';
        write($panel . '/' . $target, file_get_contents($panel . '/' . $target) . "\n// composed fixture source\n");
        $active = $baseline;
        $active[$target] = hash_file('sha256', $panel . '/' . $target);
        Files::writeJson($panel . '/storage/app/addon-manager/registry.json', ['baselineId' => $id, 'baselineRoot' => $files, 'baselineInventory' => $baseline, 'activeInventory' => $active]);
        same($profiles[0]['id'], (new SourceProfile())->detect($panel)['id'], 'Matched composed source lost its retained profile');
        $before = Files::inventory($panel, ['storage']);
        check(rename(dirname($files), $root . '/retained-baseline'), 'Cannot move retained snapshot');
        check(symlink($root . '/retained-baseline', dirname($files)), 'Cannot link retained snapshot');
        rejects(static fn () => (new SourceProfile())->detect($panel), '/symbolic|symlink/i');
        same($before, Files::inventory($panel, ['storage']));
    });
});

$suite->test('bootstrap', 'registered manager deployment lock serializes repair and recovery', function () use ($profiles): void {
    temporary(function (string $root) use ($profiles): void {
        $installer = bootstrapFixture($root, $profiles[0]);
        $installer->apply();
        Files::writeJson($root . '/state/registry.json', ['registeredFixture' => true]);
        $before = Files::inventory($root . '/panel');
        $deployment = Files::lock($root . '/state/deployment.lock');
        try {
            rejects(static fn () => $installer->apply(), '/manager deployment is running/i');
            rejects(static fn () => $installer->restore(), '/manager deployment is running/i');
        } finally { fclose($deployment); }
        same($before, Files::inventory($root . '/panel'));
        $installer->synchronized(function () use ($installer, $root): void {
            same(null, Files::lock($root . '/state/deployment.lock', false), 'Installer released the deployment lock before completion');
            same(2, count($installer->restore()['restored']), 'Deployment lock deadlocked nested recovery');
            same(2, count($installer->apply()['changed']), 'Deployment lock deadlocked nested registration');
        });
        $released = Files::lock($root . '/state/deployment.lock', false);
        check(is_resource($released), 'Installer leaked the deployment lock');
        fclose($released);
        $bootstrapLock = Files::lock($root . '/state/installer-backups/install.lock');
        try { rejects(static fn () => $installer->apply(), '/installer.*recovery.*running/i'); }
        finally { fclose($bootstrapLock); }
        $released = Files::lock($root . '/state/deployment.lock', false);
        check(is_resource($released), 'Busy bootstrap lock leaked the preceding deployment lock');
        fclose($released);
    });
});

/** Exercise retained state validation through the real host adapter without Laravel boot. */
function bootstrapStateHost(string $panel, string $state): HostAdapter
{
    $application = new class($panel, $state) {
        public function __construct(private readonly string $panel, private readonly string $state) {}
        public function basePath(string $relative = ''): string { return $this->panel . ($relative === '' ? '' : '/' . $relative); }
        public function storagePath(string $relative = ''): string { return $relative === 'app/addon-manager' ? $this->state : $this->panel . '/storage/' . $relative; }
    };
    return new HostAdapter($application, []);
}

$suite->test('bootstrap', 'fresh installer state checks do not create private state or capture a baseline', function (): void {
    temporary(function (string $root): void {
        write($root . '/panel/resources/views/base.blade.php', 'fresh source');
        $state = $root . '/panel/storage/app/addon-manager';
        $adapter = bootstrapStateHost($root . '/panel', $state);
        $installer = new Installer($root . '/panel');
        same(null, (new ReflectionMethod(Installer::class, 'existingStateChecks'))->invoke($installer, $adapter, []));
        check(!is_dir($root . '/panel/storage'), 'Fresh preflight created private manager state');
        same('fresh source', file_get_contents($root . '/panel/resources/views/base.blade.php'));
    });
});

$suite->test('bootstrap', 'retained manager preflight blocks unmanaged source drift without modifying state', function (): void {
    temporary(function (string $root): void {
        $panel = $root . '/panel';
        $state = $panel . '/storage/app/addon-manager';
        write($panel . '/resources/views/base.blade.php', 'retained source');
        (new Manager($panel, $state))->initialize(host());
        $adapter = bootstrapStateHost($panel, $state);
        $installer = new Installer($panel);
        $check = new ReflectionMethod(Installer::class, 'existingStateChecks');
        $healthy = $check->invoke($installer, $adapter, []);
        same(true, $healthy['ok']);
        same(false, $healthy['runner']['ready'], 'State verification should not require an isolated runner');
        write($panel . '/resources/views/audit-unmanaged.blade.php', 'unmanaged source edit');
        $before = Files::inventory($panel);
        $failed = $check->invoke($installer, $adapter, []);
        same(false, $failed['ok']);
        $drift = array_values(array_filter($failed['checks'], static fn (array $row): bool => $row['name'] === 'source-drift'))[0];
        same(false, $drift['ok']);
        check(str_contains($drift['message'], 'audit-unmanaged.blade.php'), 'Preflight omitted the unmanaged source path');
        same($before, Files::inventory($panel), 'Retained state preflight changed source or private state');
    });
});

$suite->test('bootstrap', 'retained preflight accepts only the declared bootstrap repair while still detecting other drift', function (): void {
    temporary(function (string $root): void {
        $panel = $root . '/panel';
        $state = $panel . '/storage/app/addon-manager';
        $beforeBytes = "<?php\nreturn \$app;\n";
        $afterBytes = "<?php\n" . SourceProfile::BOOTSTRAP_BLOCK . "return \$app;\n";
        write($panel . '/bootstrap/app.php', $afterBytes);
        (new Manager($panel, $state))->initialize(host());
        write($panel . '/bootstrap/app.php', $beforeBytes);
        $changes = ['bootstrap/app.php' => ['beforeSha256' => hash('sha256', $beforeBytes), 'afterSha256' => hash('sha256', $afterBytes), 'before' => $beforeBytes, 'after' => $afterBytes]];
        $adapter = bootstrapStateHost($panel, $state);
        $installer = new Installer($panel);
        $check = new ReflectionMethod(Installer::class, 'existingStateChecks');
        same(true, $check->invoke($installer, $adapter, $changes)['ok'], 'Known missing registration blocked a safe repair');
        same($beforeBytes, file_get_contents($panel . '/bootstrap/app.php'), 'Prospective validation applied the repair');
        write($panel . '/resources/views/unrelated.blade.php', 'unrelated drift');
        $before = Files::inventory($panel);
        same(false, $check->invoke($installer, $adapter, $changes)['ok'], 'Bootstrap repair concealed unrelated source drift');
        same($before, Files::inventory($panel));
    });
});
