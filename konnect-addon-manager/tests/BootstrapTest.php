<?php
declare(strict_types=1);

use Konnect\AddonManager\Installer\BootstrapInstaller;
use Konnect\AddonManager\Installer\SourceProfile;
use function Konnect\AddonManager\Tests\{check, rejects, same, temporary, write};

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
            $installer = new BootstrapInstaller($panel, dirname(__DIR__), $root . '/state');
            $plan = $installer->plan();
            same(2, count($plan['changes']));
            $first = $installer->apply();
            same(2, count($first['changed']));
            $installed = [];
            foreach ($original as $relative => $bytes) $installed[$relative] = file_get_contents($panel . '/' . $relative);
            foreach (['bootstrap/app.php', 'resources/views/layouts/admin.blade.php'] as $relative) {
                same(1, substr_count($installed[$relative], 'BEGIN KONNECT ADDON MANAGER'), 'Duplicate registration at ' . $relative);
                check($installed[$relative] !== $original[$relative], 'Initial registration did not change the target');
            }
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
        check(!str_contains(file_get_contents($panel . '/resources/views/layouts/admin.blade.php'), 'BEGIN KONNECT ADDON MANAGER'), 'Unsupported source was patched');
    });
});
