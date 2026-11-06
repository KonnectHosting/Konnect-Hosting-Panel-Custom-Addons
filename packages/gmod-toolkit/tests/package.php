<?php
declare(strict_types=1);

$repo = dirname(__DIR__, 3);
require $repo . '/addon-manager/bootstrap.php';
require $repo . '/addon-manager/tests/Support.php';

use AddonManager\Core\PackageValidator;
use AddonManager\Lifecycle\Manager;
use AddonManager\Storage\Files;
use function AddonManager\Tests\{check, host, operation, same, temporary, write};

$package = dirname(__DIR__) . '/addon';
$manifest = PackageValidator::validate($package);
same([], $manifest['extensions']['schedules'] ?? [], 'This addon must install without resolving the host scheduler.');
foreach (['stock' => '', 'arix' => 'arix/v2.1.3', 'arix-pack' => 'addons/v2.0.2'] as $variant => $prefix) {
    temporary(function (string $root) use ($repo, $package, $manifest, $variant, $prefix): void {
        $panel = $root . '/panel';
        foreach ($manifest['patches'] as $patch) {
            $source = $repo . '/' . ($prefix ? $prefix . '/' : '') . $patch['target'];
            if (!is_file($source)) { $source = $repo . '/arix/v2.1.3/' . $patch['target']; }
            if (!is_file($source)) { $source = $repo . '/' . $patch['target']; }
            write($panel . '/' . $patch['target'], file_get_contents($source));
        }
        // Unit lifecycle adapters only. Actual frontend compilation is exercised
        // separately; these callbacks do not establish a production sandbox.
        $config = ['isolatedRunner' => true,
            'verifyStage' => static fn () => ['isolated' => true, 'fixture' => true],
            'build' => static function (string $stage): array {
                write($stage . '/public/assets/main.js', 'fixture compiled assets');
                return ['isolated' => true, 'fixture' => true];
            },
        ];
        $manager = new Manager($panel, $root . '/state', $config);
        $manager->initialize(host());
        $fixture = ['manager' => $manager, 'panel' => $panel, 'state' => $root . '/state'];
        write($panel . '/storage/app/gmod-toolkit/backups-test.json', '{"retained":true}');
        operation($fixture, 'install', ['packageRoot' => $package]);
        foreach ($manifest['patches'] as $patch) {
            $bytes = file_get_contents($panel . '/' . $patch['target']);
            same(1, substr_count($bytes, file_get_contents($package . '/' . $patch['replace'])));
        }
        foreach ($manifest['files'] as $file) { check(is_file($panel . '/' . $file['target']), 'Payload missing after installation.'); }
        $update = $root . '/update';
        Files::copyInventory($package, $update, Files::inventory($package));
        $next = $manifest; $next['version'] = '1.1.3';
        $enabled = str_replace("'1.1.2'", "'1.1.3'", file_get_contents($update . '/payload/Enabled.php'));
        write($update . '/payload/Enabled.php', $enabled);
        foreach ($next['files'] as &$file) { if ($file['source'] === 'payload/Enabled.php') { $file['sha256'] = hash('sha256', $enabled); } }
        unset($file);
        write($update . '/manifest.json', json_encode($next));
        operation($fixture, 'update', ['addonId' => 'gmod.toolkit', 'packageRoot' => $update]);
        same('1.1.3', $manager->registry()['addons']['gmod.toolkit']['version']);
        operation($fixture, 'disable', ['addonId' => 'gmod.toolkit']);
        foreach ($manifest['patches'] as $patch) {
            $source = $repo . '/' . ($prefix ? $prefix . '/' : '') . $patch['target'];
            if (!is_file($source)) { $source = $repo . '/arix/v2.1.3/' . $patch['target']; }
            if (!is_file($source)) { $source = $repo . '/' . $patch['target']; }
            same(file_get_contents($source), file_get_contents($panel . '/' . $patch['target']));
        }
        foreach ($manifest['files'] as $file) { check(!file_exists($panel . '/' . $file['target']), 'Payload survived disable.'); }
        operation($fixture, 'enable', ['addonId' => 'gmod.toolkit']);
        operation($fixture, 'delete', ['addonId' => 'gmod.toolkit']);
        same('{"retained":true}', file_get_contents($panel . '/storage/app/gmod-toolkit/backups-test.json'));
        same([], $manager->registry()['addons']);
        // A changed exact patch target must fail before activation and retain live bytes.
        $target = $manifest['patches'][0]['target'];
        write($panel . '/' . $target, 'Changed host source');
        operation($fixture, 'install', ['packageRoot' => $package], 'failed');
        same('Changed host source', file_get_contents($panel . '/' . $target));
        same([], $manager->registry()['addons']);
        echo "PASS $variant: install, update, disable, re-enable, delete, private data retention, drift failure\n";
    });
}
