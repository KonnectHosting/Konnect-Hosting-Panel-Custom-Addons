<?php
declare(strict_types=1);

use Konnect\AddonManager\Core\ArchiveExtractor;
use Konnect\AddonManager\Core\GitHubDownloader;
use Konnect\AddonManager\Core\ManifestValidator;
use Konnect\AddonManager\Core\PackageValidator;
use Konnect\AddonManager\Core\VersionMatcher;
use function Konnect\AddonManager\Tests\{check, fileDeclaration, manifest, manifestJson, package, rejects, same, temporary, write, zip};

$suite->test('core', 'declared bytes validate and a changed payload digest rejects', function (): void {
    temporary(function (string $root): void {
        $definition = manifest();
        $definition['files'][] = fileDeclaration('payload/view.blade.php', 'resources/views/test.blade.php', 'original payload');
        $path = package($root . '/package', $definition, ['payload/view.blade.php' => 'original payload']);
        same('test.example', PackageValidator::validate($path)['id']);
        write($path . '/payload/view.blade.php', 'tampered payload');
        rejects(static fn () => PackageValidator::validate($path), '/hash|digest|checksum/i');
    });
});

$suite->test('core', 'undeclared files and symlink payloads reject valid packages', function (): void {
    temporary(function (string $root): void {
        $path = package($root . '/package', manifest());
        PackageValidator::validate($path);
        write($path . '/hidden/install.php', '<?php file_put_contents("/tmp/should-never-run", "bad");');
        rejects(static fn () => PackageValidator::validate($path), '/undeclared|unlisted|unexpected/i');
        unlink($path . '/hidden/install.php');
        rmdir($path . '/hidden');
        write($root . '/outside.txt', 'outside');
        symlink($root . '/outside.txt', $path . '/payload-link');
        rejects(static fn () => PackageValidator::validate($path), '/link|symlink/i');
    });
});

$suite->test('core', 'duplicate JSON keys and array-shaped manifest objects reject', function (): void {
    temporary(function (string $root): void {
        $definition = manifest();
        $path = package($root . '/package', $definition);
        PackageValidator::validate($path);
        $valid = manifestJson($definition);
        foreach ([
            str_replace('"id": "test.example"', '"id": "test.example", "id": "test.other"', $valid),
            str_replace('"id": "test.example"', '"id": "test.example", "\\u0069d": "test.other"', $valid),
            str_replace('"extensions": {}', '"extensions": []', $valid),
        ] as $invalid) {
            check($invalid !== $valid, 'Invalid JSON fixture was not changed');
            write($path . '/manifest.json', $invalid);
            rejects(static fn () => PackageValidator::validate($path), '/duplicate|object|shape/i');
        }
    });
});

$suite->test('core', 'hard-linked payload bytes reject even when their digest matches', function (): void {
    temporary(function (string $root): void {
        $definition = manifest();
        $definition['files'][] = fileDeclaration('payload.txt', 'resources/views/test.blade.php', 'shared bytes');
        $path = package($root . '/package', $definition, ['payload.txt' => 'shared bytes']);
        PackageValidator::validate($path);
        write($root . '/outside.txt', 'shared bytes');
        unlink($path . '/payload.txt');
        check(link($root . '/outside.txt', $path . '/payload.txt'), 'Hardlink fixture could not be constructed');
        rejects(static fn () => PackageValidator::validate($path), '/link/i');
    });
});

foreach (['.env', 'vendor/test.php', 'node_modules/test.js', 'storage/logs/test.log', 'konnect-addon-manager/bootstrap.php', 'bootstrap/app.php', 'resources/views/layouts/admin.blade.php', 'config/app.php', 'webpack.config.js', 'composer.json', 'package.json', 'yarn.lock', 'app/Http/Middleware/Admin/Arix/ArixHandler.php', 'app/Http/Controllers/Admin/Arix/ArixDashboardController.php', 'app/Http/Controllers/Auth/ArixController.php', 'app/Helpers/ArixAddons.php', 'config/arix.php', 'config/arixTheme.php', 'config/pluginsAddon.php', 'routes/admin.php', 'routes/auth.php', 'APP/HTTP/Middleware/Admin/ARIX/ArixHandler.php', 'app/Http/Middleware/AdminAuthenticate.php', 'app/Http/Middleware/RequireTwoFactorAuthentication.php', 'app/Http/Middleware/VerifyCsrfToken.php', 'APP/HTTP/MIDDLEWARE/VERIFYCSRFTOKEN.PHP', 'public/test.php', '../outside.txt', '/tmp/outside.txt', 'C:\\outside.txt', 'resources\\views\\test.blade.php'] as $target) {
    $suite->test('core', 'protected or ambiguous target rejects: ' . $target, function () use ($target): void {
        $definition = manifest();
        $definition['files'][] = fileDeclaration('payload.txt', 'resources/views/safe.blade.php', 'payload');
        ManifestValidator::validate($definition);
        $definition['files'][0]['target'] = $target;
        rejects(static fn () => ManifestValidator::validate($definition));
    });
}

$suite->test('core', 'executable installers and unknown manifest operations reject', function (): void {
    $definition = manifest();
    ManifestValidator::validate($definition);
    foreach (['installScript' => 'install.php', 'uninstall' => ['shell' => 'echo unsafe'], 'postInstall' => ['command' => 'composer install']] as $key => $value) {
        $invalid = $definition;
        $invalid[$key] = $value;
        rejects(static fn () => ManifestValidator::validate($invalid));
    }
    $invalid = $definition;
    $invalid['build'] = ['mode' => 'custom', 'command' => 'yarn add arbitrary'];
    rejects(static fn () => ManifestValidator::validate($invalid));
    $invalid = $definition;
    $invalid['database'] = ['migrations' => [['id' => 'drop-table', 'sql' => 'DROP TABLE users']]];
    rejects(static fn () => ManifestValidator::validate($invalid));
});

$suite->test('core', 'dependency patches require their owner as a declared dependency', function (): void {
    $definition = manifest('test.extension');
    $definition['patches'][] = \Konnect\AddonManager\Tests\patchDeclaration('extend', 'resources/views/a.blade.php', 'addon:test.a', 'find.txt', 'replace.txt', 'old', 'new');
    $definition['dependencies'][] = ['id' => 'test.a', 'version' => '^1.0'];
    ManifestValidator::validate($definition);
    $definition['dependencies'] = [];
    rejects(static fn () => ManifestValidator::validate($definition), '/depend/i');
});

$suite->test('core', 'version constraints enforce update and prerelease boundaries', function (): void {
    foreach ([['1.2.9', '^1.2', true], ['2.0.0', '^1.2', false], ['0.2.9', '^0.2.3', true], ['0.3.0', '^0.2.3', false], ['1.2.8', '~1.2.3', true], ['1.3.0', '~1.2.3', false], ['1.5.0', '>=1.2 <2.0', true], ['2.0.0', '>=1.2 <2.0', false], ['1.0.0-beta.1', '^1.0.0', false]] as [$version, $constraint, $expected]) {
        same($expected, VersionMatcher::matches($version, $constraint), $version . ' against ' . $constraint);
    }
});

$suite->test('core', 'declarative migrations reject destructive operations and other addon tables', function (): void {
    $valid = ['operations' => [['type' => 'createTable', 'table' => 'test_example_records', 'columns' => [['name' => 'id', 'type' => 'bigInteger']], 'primary' => ['id']]]];
    ManifestValidator::validateMigration($valid, 'test.example');
    foreach (['dropTable', 'dropColumns', 'rawSql', 'executePhp'] as $type) {
        $invalid = $valid;
        $invalid['operations'][0]['type'] = $type;
        rejects(static fn () => ManifestValidator::validateMigration($invalid, 'test.example'));
    }
    $invalid = $valid;
    $invalid['operations'][0]['table'] = 'users';
    rejects(static fn () => ManifestValidator::validateMigration($invalid, 'test.example'), '/prefix|owned/i');
    $index = ['operations' => [['type' => 'createIndex', 'table' => 'test_example_records', 'name' => 'records_id', 'columns' => ['id'], 'unique' => false]]];
    ManifestValidator::validateMigration($index, 'test.example');
    $index['operations'][0]['unique'] = true;
    rejects(static fn () => ManifestValidator::validateMigration($index, 'test.example'), '/unique|compatible|rollback/i');
    $columns = ['operations' => [['type' => 'addColumns', 'table' => 'test_example_records', 'columns' => [['name' => 'label', 'type' => 'string', 'nullable' => true]]]]];
    ManifestValidator::validateMigration($columns, 'test.example');
    $columns['operations'][0]['columns'][0] = ['name' => 'label', 'type' => 'string', 'default' => ''];
    ManifestValidator::validateMigration($columns, 'test.example');
    unset($columns['operations'][0]['columns'][0]['default']);
    rejects(static fn () => ManifestValidator::validateMigration($columns, 'test.example'), '/nullable|default|compatible/i');
});

$suite->test('core', 'native frontend edits require the manager-owned Panel build profile', function (): void {
    $definition = manifest('test.native');
    $definition['files'][] = fileDeclaration('payload/component.tsx', 'resources/scripts/addons/Component.tsx', 'export default "component";');
    $definition['build'] = ['mode' => 'panel', 'profile' => 'panel-v1', 'outputs' => ['public/assets']];
    ManifestValidator::validate($definition);
    $definition['build'] = ['mode' => 'none'];
    rejects(static fn () => ManifestValidator::validate($definition), '/frontend|build|panel/i');
});

$suite->test('core', 'jobs require declared handler classes, system permission, and unique extension IDs', function (): void {
    $definition = manifest('test.jobs');
    $definition['files'][] = fileDeclaration('payload/Worker.php', 'app/Addons/Fixture/Worker.php', '<?php namespace Pterodactyl\\Addons\\Fixture; final class Worker { public function run(): void {} }');
    $definition['extensions'] = ['jobs' => [['id' => 'fixture-job', 'handler' => 'Pterodactyl\\Addons\\Fixture\\Worker@run', 'permission' => 'system']]];
    ManifestValidator::validate($definition);
    $invalid = $definition;
    $invalid['extensions']['jobs'][0]['permission'] = 'admin';
    rejects(static fn () => ManifestValidator::validate($invalid), '/permission/i');
    $invalid = $definition;
    $invalid['extensions']['jobs'][0]['handler'] = 'Pterodactyl\\Addons\\Fixture\\Undeclared@run';
    rejects(static fn () => ManifestValidator::validate($invalid), '/handler|class|declar/i');
    $invalid = $definition;
    $invalid['extensions']['schedules'][] = ['id' => 'fixture-job', 'handler' => 'Pterodactyl\\Addons\\Fixture\\Worker@run', 'frequency' => 'daily', 'permission' => 'system'];
    rejects(static fn () => ManifestValidator::validate($invalid), '/unique|duplicate/i');
    foreach (['handler', 'permission'] as $field) {
        $invalid = $definition;
        $invalid['extensions']['jobs'][0][$field] = null;
        rejects(static fn () => ManifestValidator::validate($invalid));
    }
});

$suite->test('core', 'explicit null contract fields reject instead of receiving omitted-field defaults', function (): void {
    $definition = manifest();
    ManifestValidator::validate($definition);
    foreach (['dependencies', 'incompatible', 'files', 'patches', 'extensions', 'database', 'build', 'description'] as $field) {
        $invalid = $definition;
        $invalid[$field] = null;
        rejects(static fn () => ManifestValidator::validate($invalid));
    }
    foreach (['dataPolicy', 'migrations'] as $field) {
        $invalid = $definition;
        $invalid['database'] = ['dataPolicy' => 'preserve', 'migrations' => []];
        $invalid['database'][$field] = null;
        rejects(static fn () => ManifestValidator::validate($invalid));
    }
});

$suite->test('archive', 'designated GitHub folder extracts exactly one valid package', function (): void {
    temporary(function (string $root): void {
        $definition = manifest();
        $definition['files'][] = fileDeclaration('payload/view.blade.php', 'resources/views/test.blade.php', 'fixture view');
        $archive = zip($root . '/valid.zip', [
            ['name' => 'repository-deadbeef/addons/example/manifest.json', 'bytes' => manifestJson($definition)],
            ['name' => 'repository-deadbeef/addons/example/payload/view.blade.php', 'bytes' => 'fixture view'],
            ['name' => 'repository-deadbeef/unrelated/readme.txt', 'bytes' => 'not in the package'],
        ]);
        $selected = (new ArchiveExtractor())->extract($archive, $root . '/extracted', 'addons/example');
        same('fixture view', file_get_contents($selected . '/payload/view.blade.php'));
        same('test.example', PackageValidator::validate($selected)['id']);
        check(!file_exists($selected . '/unrelated/readme.txt'), 'Selected package contains unrelated repository files');
    });
});

$unsafeEntries = [
    'parent traversal' => [['name' => '../escaped.txt', 'bytes' => 'bad']],
    'absolute path' => [['name' => '/tmp/escaped.txt', 'bytes' => 'bad']],
    'backslash traversal' => [['name' => '..\\escaped.txt', 'bytes' => 'bad']],
    'drive path' => [['name' => 'C:/escaped.txt', 'bytes' => 'bad']],
    'normalized duplicate' => [['name' => 'payload.txt', 'bytes' => 'one'], ['name' => './payload.txt', 'bytes' => 'two']],
    'identical duplicate' => [['name' => 'payload.txt', 'bytes' => 'one'], ['name' => 'payload.txt', 'bytes' => 'two']],
    'case collision' => [['name' => 'Payload.txt', 'bytes' => 'one'], ['name' => 'payload.txt', 'bytes' => 'two']],
    'implicit parent directory case collision' => [['name' => 'Directory/one.txt', 'bytes' => 'one'], ['name' => 'directory/two.txt', 'bytes' => 'two']],
    'symbolic link' => [['name' => 'payload-link', 'bytes' => '../outside', 'mode' => 0120777]],
    'symlink parent' => [['name' => 'dir', 'bytes' => '../outside', 'mode' => 0120777], ['name' => 'dir/file.txt', 'bytes' => 'bad']],
];
foreach ($unsafeEntries as $name => $entries) {
    $suite->test('archive', $name . ' rejects without escaping staging', function () use ($entries): void {
        temporary(function (string $root) use ($entries): void {
            write($root . '/escaped.txt', 'sentinel');
            foreach ($entries as &$entry) if ($entry['name'] === '/tmp/escaped.txt') $entry['name'] = $root . '/escaped.txt';
            unset($entry);
            $archive = zip($root . '/unsafe.zip', [['name' => 'manifest.json', 'bytes' => manifestJson(manifest())], ...$entries]);
            rejects(static fn () => (new ArchiveExtractor())->extract($archive, $root . '/extracted'), '/path|relative|unsafe|traversal|duplicate|collid|link|special/i');
            same('sentinel', file_get_contents($root . '/escaped.txt'), 'Extraction overwrote a file outside staging');
            check(!file_exists($root . '/extracted'), 'Unsafe archive left an extraction directory behind');
        });
    });
}

$suite->test('archive', 'ZIP expansion, compression ratio, and entry budgets reject', function (): void {
    temporary(function (string $root): void {
        $metadata = ['name' => 'manifest.json', 'bytes' => manifestJson(manifest())];
        $expanded = zip($root . '/expanded.zip', [$metadata, ['name' => 'large.txt', 'bytes' => str_repeat('x', 1024)]]);
        (new ArchiveExtractor())->extract($expanded, $root . '/expanded-control');
        rejects(static fn () => (new ArchiveExtractor(['maxExpandedBytes' => 128]))->extract($expanded, $root . '/expanded'), '/expansion|size|limit/i');
        $ratio = zip($root . '/ratio.zip', [$metadata, ['name' => 'bomb.txt', 'bytes' => str_repeat('A', 2097152), 'deflate' => true]]);
        (new ArchiveExtractor(['maxRatio' => 100000]))->extract($ratio, $root . '/ratio-control');
        rejects(static fn () => (new ArchiveExtractor(['maxRatio' => 10]))->extract($ratio, $root . '/ratio'), '/ratio|expansion/i');
        $many = zip($root . '/many.zip', [$metadata, ['name' => 'one.txt', 'bytes' => 'one'], ['name' => 'two.txt', 'bytes' => 'two']]);
        (new ArchiveExtractor())->extract($many, $root . '/many-control');
        rejects(static fn () => (new ArchiveExtractor(['maxEntries' => 1]))->extract($many, $root . '/many'), '/entry|count|limit/i');
    });
});

$suite->test('archive', 'corrupt ZIP and reused extraction destinations reject', function (): void {
    temporary(function (string $root): void {
        $archive = zip($root . '/good.zip', [['name' => 'manifest.json', 'bytes' => manifestJson(manifest())]]);
        (new ArchiveExtractor())->extract($archive, $root . '/extracted');
        write($root . '/extracted/sentinel.txt', 'keep');
        rejects(static fn () => (new ArchiveExtractor())->extract($archive, $root . '/extracted'));
        same('keep', file_get_contents($root . '/extracted/sentinel.txt'));
        write($root . '/corrupt.zip', substr(file_get_contents($archive), 0, -12));
        rejects(static fn () => (new ArchiveExtractor())->extract($root . '/corrupt.zip', $root . '/corrupt'));
    });
});

$releaseUrl = 'https://github.com/example/addons/releases/download/v1.0.0/addon.zip';
$releaseMetadata = static fn (string $url): string => json_encode(['id' => 10, 'tag_name' => 'v1.0.0', 'assets' => [['id' => 20, 'name' => 'addon.zip', 'browser_download_url' => $url]]], JSON_THROW_ON_ERROR);
$suite->test('download', 'release download freezes received bytes and source identity', function () use ($releaseUrl, $releaseMetadata): void {
    temporary(function (string $root) use ($releaseUrl, $releaseMetadata): void {
        $bytes = file_get_contents(zip($root . '/source.zip', [['name' => 'manifest.json', 'bytes' => manifestJson(manifest())]]));
        $requests = [];
        $transport = static function (array $request) use (&$requests, $releaseUrl, $releaseMetadata, $bytes): array {
            $requests[] = $request;
            check(in_array('93.184.216.34', $request['addresses'], true), 'Transport omitted the validated destination address');
            return ['status' => 200, 'headers' => [], 'body' => str_contains($request['url'], 'api.github.com') ? $releaseMetadata($releaseUrl) : $bytes];
        };
        $result = (new GitHubDownloader($transport, static fn (string $host): array => ['93.184.216.34']))->download($releaseUrl, $root . '/download');
        same(hash('sha256', $bytes), $result['sha256']);
        $archive = $result['archive'] ?? null;
        check(is_string($archive) && is_file($archive), 'Downloader did not retain the archive');
        same($bytes, file_get_contents($archive));
        check(count($requests) >= 2, 'Release metadata and asset were not resolved independently');
        check(isset($result['source']) && is_array($result['source']), 'Immutable source metadata is missing');
    });
});

foreach (['http://github.com/example/addons/releases/download/v1.0.0/addon.zip', 'https://user:password@github.com/example/addons/releases/download/v1.0.0/addon.zip', 'https://localhost/addon.zip', 'https://127.0.0.1/addon.zip', 'https://github.com.evil.invalid/example/addons/releases/download/v1.0.0/addon.zip'] as $url) {
    $suite->test('download', 'unsupported or credentialed URL rejects before transport: ' . preg_replace('/user:password@/', '[redacted]@', $url), function () use ($url): void {
        temporary(function (string $root) use ($url): void {
            $calls = 0;
            $transport = static function (array $request) use (&$calls): array { $calls++; return ['status' => 200, 'headers' => [], 'body' => 'bad']; };
            rejects(static fn () => (new GitHubDownloader($transport, static fn (): array => ['93.184.216.34']))->download($url, $root . '/download'));
            same(0, $calls, 'Invalid URL reached the transport');
        });
    });
}

foreach (['127.0.0.1', '10.0.0.1', '169.254.169.254', '192.168.0.1', '::1', 'fe80::1', '::ffff:127.0.0.1'] as $address) {
    $suite->test('download', 'private destination address blocks transport: ' . $address, function () use ($releaseUrl, $address): void {
        temporary(function (string $root) use ($releaseUrl, $address): void {
            $calls = 0;
            $transport = static function (array $request) use (&$calls): array { $calls++; return ['status' => 200, 'headers' => [], 'body' => 'bad']; };
            rejects(static fn () => (new GitHubDownloader($transport, static fn (): array => ['93.184.216.34', $address]))->download($releaseUrl, $root . '/download'));
            same(0, $calls, 'Private DNS address reached the transport');
        });
    });
}

$suite->test('download', 'redirects are independently checked and oversized assets reject', function () use ($releaseUrl, $releaseMetadata): void {
    temporary(function (string $root) use ($releaseUrl, $releaseMetadata): void {
        $visited = [];
        $transport = static function (array $request) use (&$visited, $releaseUrl, $releaseMetadata): array {
            $visited[] = $request['url'];
            if (str_contains($request['url'], 'api.github.com')) return ['status' => 200, 'headers' => [], 'body' => $releaseMetadata($releaseUrl)];
            return ['status' => 302, 'headers' => ['Location' => 'http://169.254.169.254/latest/meta-data/'], 'body' => ''];
        };
        rejects(static fn () => (new GitHubDownloader($transport, static fn (): array => ['93.184.216.34']))->download($releaseUrl, $root . '/redirect'));
        check(!array_filter($visited, static fn (string $url): bool => str_contains($url, '169.254')), 'Redirect reached a metadata endpoint');
        $oversized = static fn (array $request): array => ['status' => 200, 'headers' => [], 'body' => str_contains($request['url'], 'api.github.com') ? $releaseMetadata($releaseUrl) : str_repeat('x', 1024)];
        rejects(static fn () => (new GitHubDownloader($oversized, static fn (): array => ['93.184.216.34'], ['maxArchiveBytes' => 512]))->download($releaseUrl, $root . '/oversized'));
    });
});

$suite->test('download', 'same-host redirect rebinding and approved-host private DNS reject', function () use ($releaseUrl, $releaseMetadata): void {
    temporary(function (string $root) use ($releaseUrl, $releaseMetadata): void {
        foreach (['same-host', 'approved-host'] as $mode) {
            $connections = [];
            $lookups = [];
            $resolver = static function (string $host) use (&$lookups, $mode): array {
                $lookups[$host] = ($lookups[$host] ?? 0) + 1;
                if ($host === 'release-assets.githubusercontent.com' || ($mode === 'same-host' && $host === 'github.com' && $lookups[$host] > 1)) return ['169.254.169.254'];
                return ['93.184.216.34'];
            };
            $transport = static function (array $request) use (&$connections, $mode, $releaseUrl, $releaseMetadata): array {
                $connections[] = $request['host'];
                if ($request['host'] === 'api.github.com') return ['status' => 200, 'headers' => [], 'body' => $releaseMetadata($releaseUrl)];
                return ['status' => 302, 'headers' => ['Location' => $mode === 'same-host' ? $releaseUrl . '?redirected=1' : 'https://release-assets.githubusercontent.com/path/addon.zip'], 'body' => ''];
            };
            rejects(static fn () => (new GitHubDownloader($transport, $resolver))->download($releaseUrl, $root . '/' . $mode), '/address|forbidden|private/i');
            same(['api.github.com', 'github.com'], $connections, 'Private redirect address reached transport');
            if ($mode === 'same-host') same(2, $lookups['github.com'], 'Redirect reused stale DNS authorization');
            else same(1, $lookups['release-assets.githubusercontent.com'], 'Approved redirect host was not revalidated');
        }
    });
});

$suite->test('download', 'GitHub folder ref resolves once and uses an immutable commit archive', function (): void {
    temporary(function (string $root): void {
        $commit = str_repeat('a', 40);
        $bytes = file_get_contents(zip($root . '/source.zip', [['name' => 'repository-' . $commit . '/addons/example/manifest.json', 'bytes' => manifestJson(manifest())]]));
        $requests = [];
        $transport = static function (array $request) use (&$requests, $bytes, $commit): array {
            $requests[] = $request['url'];
            if ($request['host'] === 'api.github.com') {
                if (str_ends_with($request['url'], '/commits/main')) return ['status' => 200, 'headers' => [], 'body' => json_encode(['sha' => $commit], JSON_THROW_ON_ERROR)];
                return ['status' => 404, 'headers' => [], 'body' => '{"message":"Not Found"}'];
            }
            same('https://codeload.github.com/example/addons/zip/' . $commit, $request['url'], 'Archive URL used a moving ref');
            return ['status' => 200, 'headers' => [], 'body' => $bytes];
        };
        $result = (new GitHubDownloader($transport, static fn (): array => ['93.184.216.34']))->download('https://github.com/example/addons/tree/main/addons/example', $root . '/download');
        same($commit, $result['source']['commit']);
        same('main', $result['source']['ref']);
        same('addons/example', $result['folder']);
        $selected = (new ArchiveExtractor())->extract($result['archive'], $root . '/extracted', $result['folder']);
        same('test.example', PackageValidator::validate($selected)['id']);
        same(1, count(array_filter($requests, static fn (string $url): bool => str_ends_with($url, '/commits/main'))));
    });
});
