#!/usr/bin/env php
<?php

declare(strict_types=1);

if (!defined('LARAVEL_START')) define('LARAVEL_START', microtime(true));

// This suite deliberately needs an INSTALLED disposable Panel fixture with its
// real locked Composer dependencies. It is separate from the standalone suite.
require dirname(__DIR__) . '/bootstrap.php';
require __DIR__ . '/Support.php';

use Illuminate\Http\Request;
use AddonManager\Core\ManifestValidator;
use AddonManager\Laravel\ExtensionRegistry;
use AddonManager\Laravel\AddonJob;
use AddonManager\Laravel\DatabaseBackup;
use AddonManager\Laravel\ManagerSchema;
use AddonManager\Laravel\HostAdapter;
use AddonManager\Laravel\MigrationExecutor;
use AddonManager\Tests\Suite;
use Pterodactyl\Models\User;
use function AddonManager\Tests\{check, rejects, same, write};

$root = realpath(getenv('ADDON_MANAGER_TEST_PANEL_ROOT') ?: ($argv[1] ?? ''));
if ($root === false || !is_file($root . '/storage/app/addon-manager/registry.json')) {
    fwrite(STDERR, "Set ADDON_MANAGER_TEST_PANEL_ROOT to an installed disposable Panel fixture; never run on a live Panel.\n");
    exit(2);
}
if (getenv('ADDON_MANAGER_ALLOW_DISPOSABLE_TESTS') !== '1') {
    fwrite(STDERR, "Set ADDON_MANAGER_ALLOW_DISPOSABLE_TESTS=1 to explicitly identify this fixture as disposable.\n");
    exit(2);
}
$host = HostAdapter::boot($root);
$app = $host->application();
$app['env'] = 'production'; // Keep real CSRF checks enabled, even if fixture .env says testing.
$app['config']->set('session.driver', 'array');
$app['config']->set('cache.default', 'array');
$app['config']->set('pterodactyl.auth.2fa_required', 0);
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$suite = new Suite();
$stateRoot = $host->stateRoot;
$registryFile = $stateRoot . '/registry.json';
$originalRegistry = file_get_contents($registryFile);
$testFiles = [$root . '/app/Addons/AddonManagerIntegration/Probe.php', $root . '/resources/views/addons/addonManager_integration/index.blade.php'];
$originalFiles = [];
$queuedOperationIds = [];
foreach ($testFiles as $file) $originalFiles[$file] = is_file($file) ? file_get_contents($file) : null;

function addonManagerHttp(object $app, object $kernel, string $method, string $path, ?User $user = null, array $body = [], bool $csrf = true): object
{
    $guard = $app['auth']->guard();
    $guard->forgetUser();
    if ($user !== null) $guard->setUser($user);
    $session = $app['session']->driver();
    $session->start();
    $headers = ['HTTP_ACCEPT' => 'application/json', 'CONTENT_TYPE' => 'application/json'];
    if ($csrf) $headers['HTTP_X_CSRF_TOKEN'] = $session->token();
    $request = Request::create($path, $method, [], [], [], $headers, json_encode($body, JSON_THROW_ON_ERROR));
    return $kernel->handle($request);
}

$admin = new User();
$admin->forceFill(['id' => 987654, 'root_admin' => true, 'use_totp' => true, 'password' => 'integration-synthetic-password', 'language' => 'en', 'email' => 'admin@example.invalid']);
$ordinary = new User();
$ordinary->forceFill(['id' => 987655, 'root_admin' => false, 'use_totp' => false, 'password' => 'integration-synthetic-password', 'language' => 'en', 'email' => 'user@example.invalid']);

$suite->test('laravel', 'anonymous and ordinary users cannot read manager API', static function () use ($app, $kernel, $ordinary): void {
    foreach ([null, $ordinary] as $user) {
        $response = addonManagerHttp($app, $kernel, 'GET', '/admin/addon-manager/api/addons', $user);
        same(403, $response->getStatusCode());
        check(isset(json_decode($response->getContent(), true)['message']), 'Authorization failure did not use JSON envelope');
    }
});
$suite->test('laravel', 'root admin reads listing success envelope', static function () use ($app, $kernel, $admin): void {
    $response = addonManagerHttp($app, $kernel, 'GET', '/admin/addon-manager/api/addons', $admin);
    same(200, $response->getStatusCode(), $response->getContent());
    check(array_key_exists('data', json_decode($response->getContent(), true)), 'Listing omitted data envelope');
});
$suite->test('laravel', 'admin manager page renders the active layout navigation and prebuilt assets', static function () use ($app, $kernel, $admin): void {
    $response = addonManagerHttp($app, $kernel, 'GET', '/admin/addon-manager', $admin);
    same(200, $response->getStatusCode(), $response->getContent());
    foreach (['Addon Manager', 'addon-manager/build/manager.v1.js', 'addon-manager/build/manager.v1.css'] as $needle) {
        check(str_contains($response->getContent(), $needle), 'Manager page omitted ' . $needle);
    }
});
$suite->test('laravel', 'management POST requires session CSRF', static function () use ($app, $kernel, $admin): void {
    $response = addonManagerHttp($app, $kernel, 'POST', '/admin/addon-manager/api/operations', $admin, ['action' => 'disable', 'addonId' => 'integration.example', 'requestId' => 'integration-csrf-0001'], false);
    same(419, $response->getStatusCode(), $response->getContent());
    check(isset(json_decode($response->getContent(), true)['message']), 'CSRF failure omitted envelope');
});
$suite->test('laravel', 'two-factor requirement covers management API', static function () use ($app, $kernel, $admin): void {
    $withoutTotp = clone $admin;
    $withoutTotp->use_totp = false;
    $app['config']->set('pterodactyl.auth.2fa_required', 1);
    try {
        $response = addonManagerHttp($app, $kernel, 'GET', '/admin/addon-manager/api/addons', $withoutTotp);
        same(400, $response->getStatusCode(), $response->getContent());
        check(str_contains(json_decode($response->getContent(), true)['message'], 'Two-factor'), '2FA rejection reason missing');
    } finally {
        $app['config']->set('pterodactyl.auth.2fa_required', 0);
    }
});
$suite->test('laravel', 'HTTP enqueue returns durable operation and exact reviewed-impact replay', static function () use ($app, $kernel, $admin, $host, $registryFile, &$queuedOperationIds): void {
    $registry = json_decode(file_get_contents($registryFile), true, 512, JSON_THROW_ON_ERROR);
    $manifest = ManifestValidator::validate(['manifestVersion' => 1, 'id' => 'integration.example', 'name' => 'Integration Example', 'version' => '1.0.0', 'compatibility' => ['php' => '^8.2', 'panel' => '^1.15', 'manager' => '^2.0']]);
    $registry['addons']['integration.example'] = ['id' => 'integration.example', 'name' => $manifest['name'], 'version' => '1.0.0', 'enabled' => true, 'manifest' => $manifest, 'packageDigest' => hash('sha256', json_encode($manifest)), 'packagePath' => $host->stateRoot . '/integration-package'];
    write($registryFile, json_encode($registry, JSON_THROW_ON_ERROR));
    $body = ['action' => 'disable', 'addonId' => 'integration.example', 'expectedAffectedIds' => ['integration.example'], 'requestId' => 'integration-http-' . bin2hex(random_bytes(8))];
    $first = addonManagerHttp($app, $kernel, 'POST', '/admin/addon-manager/api/operations', $admin, $body);
    same(202, $first->getStatusCode(), $first->getContent());
    $operation = json_decode($first->getContent(), true)['data'];
    $queuedOperationIds[] = $operation['id'];
    same('queued', $operation['status']);
    same('queued', $host->manager()->operation($operation['id'])['status']);
    same(['integration.example'], $operation['arguments']['expectedAffectedIds']);
    $second = addonManagerHttp($app, $kernel, 'POST', '/admin/addon-manager/api/operations', $admin, $body);
    same(202, $second->getStatusCode(), $second->getContent());
    same($operation['id'], json_decode($second->getContent(), true)['data']['id']);
    $body['cascade'] = true;
    $different = addonManagerHttp($app, $kernel, 'POST', '/admin/addon-manager/api/operations', $admin, $body);
    same(422, $different->getStatusCode());
});

$suite->test('laravel', 'enabled admin page route menu event schedule job registrations obey live version guard', static function () use ($app, $host, $registryFile, $root, $admin, $ordinary): void {
    $handler = '<?php namespace Pterodactyl\\Addons\\AddonManagerIntegration; final class Probe { public static int $calls=0; public function handle(mixed $event=null): array { return ["calls"=>++self::$calls]; } }';
    $view = '<p>{{ $addon["id"] }}:{{ $addonPage["title"] }}</p>';
    write($root . '/app/Addons/AddonManagerIntegration/Probe.php', $handler);
    write($root . '/resources/views/addons/addonManager_integration/index.blade.php', $view);
    $manifest = ManifestValidator::validate([
        'manifestVersion' => 1, 'id' => 'integration.example', 'name' => 'Integration Example', 'version' => '1.0.0',
        'compatibility' => ['php' => '^8.2', 'panel' => '^1.15', 'manager' => '^2.0'],
        'files' => [
            ['source' => 'payload/Probe.php', 'target' => 'app/Addons/AddonManagerIntegration/Probe.php', 'sha256' => hash('sha256', $handler)],
            ['source' => 'payload/page.blade.php', 'target' => 'resources/views/addons/addonManager_integration/index.blade.php', 'sha256' => hash('sha256', $view)],
        ],
        'extensions' => [
            'pages' => [['id' => 'example.page', 'path' => 'page', 'title' => 'Example', 'view' => 'addons.addonManager_integration.index', 'permission' => 'admin']],
            'routes' => [['id' => 'example.route', 'path' => 'probe', 'method' => 'GET', 'handler' => 'Pterodactyl\\Addons\\AddonManagerIntegration\\Probe@handle', 'permission' => 'admin']],
            'menus' => [['id' => 'example.menu', 'label' => 'Example', 'page' => 'example.page']],
            'events' => [['id' => 'example.event', 'event' => 'Pterodactyl\\Events\\AddonManagerIntegrationEvent', 'handler' => 'Pterodactyl\\Addons\\AddonManagerIntegration\\Probe@handle', 'permission' => 'system']],
            'schedules' => [['id' => 'example.schedule', 'handler' => 'Pterodactyl\\Addons\\AddonManagerIntegration\\Probe@handle', 'frequency' => 'everyMinute', 'permission' => 'system']],
            'jobs' => [['id' => 'example.job', 'handler' => 'Pterodactyl\\Addons\\AddonManagerIntegration\\Probe@handle', 'permission' => 'system']],
        ],
    ]);
    $registry = json_decode(file_get_contents($registryFile), true, 512, JSON_THROW_ON_ERROR);
    $registry['addons']['integration.example'] = ['id' => 'integration.example', 'name' => $manifest['name'], 'version' => '1.0.0', 'enabled' => true, 'manifest' => $manifest];
    write($registryFile, json_encode($registry, JSON_THROW_ON_ERROR));
    $extensions = new ExtensionRegistry($app, $host);
    $extensions->registerRoutes();
    $extensions->registerEvents();
    $app['auth']->guard()->setUser($admin);
    check(count($extensions->menus()) === 1, 'Enabled addon menu missing');
    $app['events']->dispatch('Pterodactyl\\Events\\AddonManagerIntegrationEvent', ['fixture']);
    same(1, \Pterodactyl\Addons\AddonManagerIntegration\Probe::$calls);
    $job = new AddonJob('integration.example', '1.0.0', 'example.job', ['plain' => 'json']);
    $job->handle($extensions);
    same(2, \Pterodactyl\Addons\AddonManagerIntegration\Probe::$calls);
    $schedule = new \Illuminate\Console\Scheduling\Schedule('UTC');
    $extensions->registerSchedules($schedule);
    $scheduled = $schedule->events()[0];
    $scheduled->run($app);
    same(3, \Pterodactyl\Addons\AddonManagerIntegration\Probe::$calls);
    rejects(static fn () => new AddonJob('integration.example', '1.0.0', 'example.job', ['object' => new stdClass()]), '/plain JSON/i');
    $request = Request::create('/admin/addon-manager/extensions/integration.example/page');
    $request->setUserResolver(static fn () => $admin);
    $route = $app['router']->getRoutes()->match($request);
    $request->setRouteResolver(static fn () => $route);
    check(str_contains($extensions->dispatch($request)->render(), 'integration.example:Example'), 'Standalone page did not render');
    $request->setUserResolver(static fn () => $ordinary);
    rejects(static fn () => $extensions->dispatch($request));
    $registry['addons']['integration.example']['enabled'] = false;
    write($registryFile, json_encode($registry, JSON_THROW_ON_ERROR));
    $app['events']->dispatch('Pterodactyl\\Events\\AddonManagerIntegrationEvent', ['fixture']);
    $job->handle($extensions);
    $scheduled->run($app);
    same(3, \Pterodactyl\Addons\AddonManagerIntegration\Probe::$calls, 'Disabled addon event/job/schedule handler ran');
    same([], $extensions->menus());
    $request->setUserResolver(static fn () => $admin);
    rejects(static fn () => $extensions->dispatch($request));
    $registry['addons']['integration.example']['enabled'] = true;
    $registry['addons']['integration.example']['version'] = '1.1.0';
    $registry['addons']['integration.example']['manifest']['version'] = '1.1.0';
    write($registryFile, json_encode($registry, JSON_THROW_ON_ERROR));
    rejects(static fn () => $extensions->dispatch($request));
    $app['events']->dispatch('Pterodactyl\\Events\\AddonManagerIntegrationEvent', ['fixture']);
    $job->handle($extensions);
    $scheduled->run($app);
    same(3, \Pterodactyl\Addons\AddonManagerIntegration\Probe::$calls, 'Old-version event/job/schedule registration ran');
});

$suite->test('laravel', 'additive migrations create extend index and retain data across exact replay', static function () use ($app, $stateRoot): void {
    $packageRoot = $stateRoot . '/test-migration-package';
    $table = 'integration_migration_fixture';
    $document = ['operations' => [
        ['type' => 'createTable', 'table' => $table, 'columns' => [
            ['name' => 'id', 'type' => 'integer'], ['name' => 'label', 'type' => 'string', 'length' => 80],
            ['name' => 'details', 'type' => 'text', 'nullable' => true], ['name' => 'count', 'type' => 'bigInteger', 'default' => 0],
            ['name' => 'created', 'type' => 'timestamp', 'nullable' => true, 'default' => null], ['name' => 'metadata', 'type' => 'json', 'nullable' => true],
            ['name' => 'literal_null', 'type' => 'string', 'nullable' => true, 'default' => 'NULL'],
        ], 'primary' => ['id']],
        ['type' => 'addColumns', 'table' => $table, 'columns' => [['name' => 'active', 'type' => 'boolean', 'default' => false]]],
        ['type' => 'createIndex', 'table' => $table, 'name' => 'integration_migration_label', 'columns' => ['label']],
    ]];
    $bytes = json_encode($document, JSON_THROW_ON_ERROR);
    write($packageRoot . '/migration.json', $bytes);
    $migration = ['id' => 'schema.v1.' . bin2hex(random_bytes(4)), 'source' => 'migration.json', 'sha256' => hash('sha256', $bytes)];
    $manifest = ['database' => ['migrations' => [$migration]]];
    $operation = ['id' => 'integration-migration', 'packages' => ['integration.migration' => ['packagePath' => $packageRoot]]];
    $connection = $app['db']->connection();
    $connection->getSchemaBuilder()->dropIfExists($table);
    try {
        $executor = new MigrationExecutor($connection, $stateRoot);
        $first = $executor->apply(['integration.migration' => $manifest], $operation);
        same('complete', $first[0]['status']);
        $connection->table($table)->insert(['id' => 1, 'label' => 'retained']);
        $second = $executor->apply(['integration.migration' => $manifest], $operation);
        same('already-applied', $second[0]['status']);
        same('retained', $connection->table($table)->where('id', 1)->value('label'));
        rejects(static fn () => $executor->validate('integration.migration', ['operations' => [['type' => 'createIndex', 'table' => $table, 'name' => 'integration_migration_unique', 'columns' => ['label'], 'unique' => true]]]), '/Unique indexes|previous code/i');
        $foreign = json_encode(['operations' => [['type' => 'addColumns', 'table' => $table, 'columns' => [['name' => 'foreign_owner', 'type' => 'string', 'nullable' => true]]]]], JSON_THROW_ON_ERROR);
        write($packageRoot . '/foreign.json', $foreign);
        $foreignManifest = ['database' => ['migrations' => [['id' => 'foreign.v1.' . bin2hex(random_bytes(4)), 'source' => 'foreign.json', 'sha256' => hash('sha256', $foreign)]]]];
        $foreignOperation = ['id' => 'integration-foreign', 'packages' => ['integration-migration' => ['packagePath' => $packageRoot]]];
        rejects(static fn () => $executor->apply(['integration-migration' => $foreignManifest], $foreignOperation), '/not owned|exact addon/i');
        check(!$connection->getSchemaBuilder()->hasColumn($table, 'foreign_owner'), 'Sanitized ID collision altered another addon table');
        $manifest['database']['migrations'][0]['sha256'] = str_repeat('0', 64);
        rejects(static fn () => $executor->apply(['integration.migration' => $manifest], $operation), '/changed|checksum/i');
        rejects(static fn () => $executor->validate('integration.migration', ['operations' => [['type' => 'dropTable', 'table' => $table]]]), '/Unsupported/i');
    } finally {
        $connection->getSchemaBuilder()->dropIfExists($table);
    }
});

$suite->test('laravel', 'full InnoDB snapshot is checksummed and idempotent without retained credentials', static function () use ($app, $stateRoot): void {
    $connection = $app['db']->connection();
    foreach ([PDO::MYSQL_ATTR_SSL_CAPATH, PDO::MYSQL_ATTR_SSL_CIPHER] as $attribute) {
        $restricted = new class($connection, $attribute) {
            public function __construct(private readonly object $connection, private readonly int $attribute) {}
            public function getDriverName(): string { return $this->connection->getDriverName(); }
            public function select(string $query, array $bindings): array { return $this->connection->select($query, $bindings); }
            public function getConfig(): array { return array_replace($this->connection->getConfig(), ['options' => [$this->attribute => 'restricted-tls-policy']]); }
        };
        rejects(static fn () => (new DatabaseBackup($restricted, $stateRoot))->create('integration-tls-' . bin2hex(random_bytes(6))), '/will not omit/i');
        same([], glob($stateRoot . '/database-backups/.client-*.cnf') ?: [], 'Unsupported TLS policy retained credentials');
    }
    $snapshot = new DatabaseBackup($connection, $stateRoot);
    $id = 'integration-backup-' . bin2hex(random_bytes(6));
    $backup = $snapshot->create($id);
    try {
        check($backup['bytes'] > 0, 'Database snapshot has no bytes');
        same($backup['sha256'], hash_file('sha256', $backup['path']));
        same($backup, $snapshot->create($id));
        check(str_contains(file_get_contents($backup['path']), 'addon_manager_addon_migrations'), 'Snapshot omitted manager data');
        same([], glob($stateRoot . '/database-backups/.client-*.cnf') ?: [], 'Database backup retained connection credentials');
    } finally {
        if (is_file($backup['path'])) unlink($backup['path']);
        if (is_file($backup['path'] . '.json')) unlink($backup['path'] . '.json');
    }
});

$suite->test('laravel', 'SQL mirror removes stale active state retains history and stores terminal status with bounded keys', static function () use ($app): void {
    $connection = $app['db']->connection();
    $connection->beginTransaction();
    try {
        $id = 'integration.mirror';
        $addon = ['id' => $id, 'version' => '1.0.0', 'enabled' => true, 'manifest' => ['dependencies' => [['id' => 'integration.dependency', 'version' => '^1.0']]]];
        $path = 'public/assets/' . str_repeat('long-declared-path/', 20) . 'file.js';
        $operation = ['id' => 'integration-mirror-' . bin2hex(random_bytes(4)), 'status' => 'running'];
        ManagerSchema::mirror($connection, ['addons' => [$id => $addon], 'activeInventory' => [$path => str_repeat('a', 64)]], $operation);
        same(1, $connection->table('addon_manager_addons')->count());
        same(1, $connection->table('addon_manager_addon_dependencies')->count());
        same(1, $connection->table('addon_manager_addon_file_changes')->count());
        check(strlen($connection->table('addon_manager_addon_file_changes')->value('record_key')) === 64, 'SQL key did not use bounded digest');
        ManagerSchema::mirror($connection, ['addons' => [], 'activeInventory' => []], array_replace($operation, ['status' => 'succeeded']));
        same(0, $connection->table('addon_manager_addons')->count());
        same(0, $connection->table('addon_manager_addon_dependencies')->count());
        same(0, $connection->table('addon_manager_addon_file_changes')->count());
        check($connection->table('addon_manager_addon_versions')->where('record_key', hash('sha256', $id . '@1.0.0'))->exists(), 'Version history was lost');
        $stored = json_decode($connection->table('addon_manager_addon_operations')->where('record_key', hash('sha256', $operation['id']))->value('payload'), true);
        same('succeeded', $stored['status']);
    } finally {
        $connection->rollBack();
    }
});

try {
    $report = getenv('ADDON_MANAGER_TEST_REPORT');
    $status = $suite->run($report ? ['--json=' . $report] : []);
} finally {
    file_put_contents($registryFile, $originalRegistry);
    foreach ($originalFiles as $file => $bytes) {
        if ($bytes === null) { if (is_file($file)) unlink($file); }
        else file_put_contents($file, $bytes);
    }
    foreach ($queuedOperationIds as $id) {
        $operationFile = $stateRoot . '/operations/' . $id . '.json';
        if (is_file($operationFile)) unlink($operationFile);
    }
    foreach (glob($stateRoot . '/requests/*.json') ?: [] as $file) {
        $index = json_decode(file_get_contents($file), true);
        if (in_array($index['operationId'] ?? '', $queuedOperationIds, true)) unlink($file);
    }
}
exit($status);
