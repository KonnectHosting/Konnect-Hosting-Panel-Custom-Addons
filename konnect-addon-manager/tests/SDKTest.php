<?php
declare(strict_types=1);

use Konnect\AddonManager\Core\ArchiveExtractor;
use Konnect\AddonManager\Core\PackageValidator;
use function Konnect\AddonManager\Tests\{check, fileDeclaration, manifest, package, phpCommand, same, temporary, write};

foreach (['basic-admin-page' => 'konnect.demo', 'dependency-banner' => 'konnect.demo-banner', 'incompatible-banner' => 'konnect.demo-conflict'] as $example => $expectedId) {
    $suite->test('sdk', 'exported ' . $example . ' is a self-contained validated ZIP', function () use ($example, $expectedId): void {
        temporary(function (string $root) use ($example, $expectedId): void {
            $output = $root . '/addon.zip';
            $result = phpCommand(dirname(__DIR__) . '/sdk/bin/addon.php', ['export', dirname(__DIR__) . '/sdk/examples/' . $example, '--output=' . $output]);
            same(0, $result['exit'], 'SDK export rejected sample: ' . $result['stderr']);
            $receipt = json_decode(trim($result['stdout']), true, 512, JSON_THROW_ON_ERROR);
            same(hash_file('sha256', $output), $receipt['sha256']);
            check(str_starts_with(file_get_contents($output . '.sha256'), $receipt['sha256'] . ' '), 'SDK checksum sidecar disagrees with bytes');
            $selected = (new ArchiveExtractor())->extract($output, $root . '/extracted');
            $manifest = PackageValidator::validate($selected);
            same($expectedId, $manifest['id']);
            same('1.0.0', $manifest['version']);
        });
    });
}

$suite->test('sdk', 'repeat exports are identical and existing outputs cannot be overwritten', function (): void {
    temporary(function (string $root): void {
        $script = dirname(__DIR__) . '/sdk/bin/addon.php';
        $source = dirname(__DIR__) . '/sdk/examples/basic-admin-page';
        foreach (['first', 'second'] as $name) {
            $result = phpCommand($script, ['export', $source, '--output=' . $root . '/' . $name . '.zip']);
            same(0, $result['exit'], $result['stderr']);
        }
        same(file_get_contents($root . '/first.zip'), file_get_contents($root . '/second.zip'), 'Export bytes contain nondeterministic metadata');
        $digest = hash_file('sha256', $root . '/first.zip');
        $refused = phpCommand($script, ['export', $source, '--output=' . $root . '/first.zip']);
        same(1, $refused['exit']);
        same($digest, hash_file('sha256', $root . '/first.zip'), 'Rejected repeat export overwrote existing bytes');
    });
});

foreach (['digest mismatch', 'undeclared payload'] as $case) {
    $suite->test('sdk', $case . ' fails export without producing an archive', function () use ($case): void {
        temporary(function (string $root) use ($case): void {
            $definition = manifest();
            $definition['files'][] = fileDeclaration('payload.txt', 'resources/views/example.blade.php', 'original');
            $source = package($root . '/package', $definition, ['payload.txt' => 'original']);
            if ($case === 'digest mismatch') write($source . '/payload.txt', 'changed');
            else write($source . '/undeclared.txt', 'unexpected');
            $result = phpCommand(dirname(__DIR__) . '/sdk/bin/addon.php', ['export', $source, '--output=' . $root . '/addon.zip']);
            same(1, $result['exit'], 'Invalid SDK package did not preserve a failure exit status');
            check(!is_file($root . '/addon.zip') && !is_file($root . '/addon.zip.sha256'), 'Failed export left an apparently publishable archive');
        });
    });
}

$suite->test('sdk', 'release ZIP contains only manager files and its checksum verifies', function (): void {
    temporary(function (string $root): void {
        $path = $root . '/manager.zip';
        $result = phpCommand(dirname(__DIR__) . '/tools/package-release.php', ['--output=' . $path]);
        same(0, $result['exit'], 'Manager release packaging failed: ' . $result['stderr']);
        $receipt = json_decode(trim($result['stdout']), true, 512, JSON_THROW_ON_ERROR);
        same(hash_file('sha256', $path), $receipt['sha256']);
        check(str_starts_with(file_get_contents($path . '.sha256'), $receipt['sha256'] . ' '), 'Manager release checksum disagrees with bytes');
        $archive = new ZipArchive();
        same(true, $archive->open($path));
        $names = [];
        try {
            for ($index = 0; $index < $archive->numFiles; $index++) {
                $name = $archive->getNameIndex($index);
                $names[] = $name;
                check(str_starts_with($name, 'konnect-addon-manager/'), 'Release included a host Panel file');
                check(preg_match('~/(?:tests|state|storage|vendor|node_modules|backups|journals|staging|\.[^/]+)(?:/|$)~', $name) !== 1, 'Release included private/development state: ' . $name);
            }
        } finally { $archive->close(); }
        foreach (['install.php', 'bootstrap.php', 'bin/manager.php', 'public/build/manager.v1.js', 'public/build/manager.v1.css', 'schemas/addon.schema.json'] as $required) check(in_array('konnect-addon-manager/' . $required, $names, true), 'Manager release lacks ' . $required);
        same(count($names), count(array_unique($names)), 'Release contains duplicate paths');
    });
});
