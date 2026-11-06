<?php
declare(strict_types=1);

// Real Panel/Laravel dependencies, synthetic users/servers and fake Wings/Steam.
// This suite never contacts a node or Valve and must use a disposable Panel copy.
if (getenv('GMOD_TOOLKIT_DISPOSABLE') !== '1') { fwrite(STDERR, "Set GMOD_TOOLKIT_DISPOSABLE=1 for a disposable fixture only.\n"); exit(2); }
$panel = realpath($argv[1] ?? '');
if (!$panel || !is_file($panel . '/vendor/autoload.php')) { throw new RuntimeException('Supply a disposable Panel with locked Composer dependencies.'); }
foreach (['APP_ENV' => 'testing', 'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'APP_KEY' => 'base64:' . base64_encode(str_repeat('k', 32))] as $key => $value) {
    $_ENV[$key] = $_SERVER[$key] = $value;
}
define('LARAVEL_START', microtime(true));
require $panel . '/vendor/autoload.php';
require $panel . '/addon-manager/bootstrap.php';
$app = require $panel . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(static function (\Throwable $error): void { fwrite(STDERR, (string) $error . "\n"); exit(1); });

use Illuminate\Http\Request;
use Illuminate\Database\Eloquent\Collection;
use Pterodactyl\Models\User;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Subuser;
use Pterodactyl\Models\Node;
use Pterodactyl\Addons\GmodToolkit\{Workshop,State,Access,WingsFiles,Fastdl,ToolkitController,Enabled};
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

function same($expected, $actual): void { if ($expected !== $actual) { throw new RuntimeException('Expected ' . json_encode($expected) . '; got ' . json_encode($actual)); } }
function reject(callable $fn, ?int $status = null): void {
    try { $fn(); } catch (\Throwable $e) {
        if ($status !== null) { same($status, $e instanceof HttpExceptionInterface ? $e->getStatusCode() : null); }
        return;
    }
    throw new RuntimeException('Expected operation to fail.');
}
$passed = 0;
function test(string $name, callable $fn): void { global $passed; $fn(); ++$passed; echo "PASS $name\n"; }
function requestFor(?User $user, array $data = []): Request {
    $r = Request::create('/test', 'POST', $data);
    $r->setUserResolver(static fn () => $user);
    return $r;
}
function user(int $id, bool $admin = false): User { $u = new User(); $u->forceFill(['id' => $id, 'root_admin' => $admin, 'use_totp' => false]); return $u; }

$fixture = [
    '100' => ['type' => 2, 'children' => ['101', '200', '101']],
    '101' => ['type' => 0, 'title' => 'Map "with quotes"'],
    '200' => ['type' => 2, 'children' => ['101', '102', '100']],
    '102' => ['type' => 0, 'title' => '<script>alert(1)</script>'],
];
$fetch = static function (string $method, array $ids) use (&$fixture): array {
    $items = [];
    foreach ($ids as $id) {
        $row = $fixture[$id] ?? [];
        $items[] = $method === 'GetCollectionDetails'
            ? ['publishedfileid' => $id, 'result' => ($row['type'] ?? null) === 2 ? ($row['result'] ?? 1) : 9,
                'children' => array_map(static fn ($v) => ['publishedfileid' => $v, 'filetype' => $fixture[$v]['type'] ?? 0], $row['children'] ?? [])]
            // Steam's published-file response can omit file_type entirely.
            : ['publishedfileid' => $id, 'result' => $row['result'] ?? 1, 'consumer_app_id' => $row['app'] ?? 4000, 'title' => $row['title'] ?? $id];
    }
    return [$method === 'GetCollectionDetails' ? 'collectiondetails' : 'publishedfiledetails' => $items];
};
$workshop = new Workshop($fetch);
test('collection links, nested resolution, cycles, duplicate removal and safe Lua', function () use ($workshop) {
    $result = $workshop->resolve('https://steamcommunity.com/sharedfiles/filedetails/?id=100');
    same(['101', '102'], array_column($result['items'], 'id'));
    same(2, $result['collections']); same(3, $result['duplicates']);
    same(2, substr_count($result['lua'], 'resource.AddWorkshop('));
    same(false, str_contains($result['lua'], '<script>'));
    same('18446744073709551615', Workshop::id('18446744073709551615'));
    same('100', Workshop::id('http://SteamCommunity.com/sharedfiles/filedetails?id=100'));
});
test('Steam collection shape works without optional published-file type metadata', function () use (&$fixture, $workshop) {
    $fixture['3788779421'] = ['type' => 2, 'children' => ['200', '101']];
    foreach (['3788779421', 'https://steamcommunity.com/sharedfiles/filedetails/?id=3788779421'] as $input) {
        $result = $workshop->resolve($input);
        same('3788779421', $result['collection']);
        same(['101', '102'], array_column($result['items'], 'id'));
        same(false, str_contains($result['lua'], 'resource.AddWorkshop("200")'));
    }
    unset($fixture['3788779421']);
});
test('unknown collection entry types fail instead of generating incorrect downloads', function () use (&$fixture, $workshop) {
    $fixture['102']['type'] = 1;
    reject(fn () => $workshop->resolve('100'));
    $fixture['102']['type'] = 0;
});
test('invalid hosts, credentials, duplicate query IDs and numeric overflow rejected', function () {
    foreach (['https://evil.test/?id=100', 'https://steamcommunity.com.evil.test/sharedfiles/filedetails/?id=100', 'https://user@steamcommunity.com/sharedfiles/filedetails/?id=100', 'https://steamcommunity.com/sharedfiles/filedetails/?id=100&id=101', '18446744073709551616', '1e10', '0', '1"\ncode'] as $value) {
        reject(static fn () => Workshop::id($value));
    }
});
test('private, unavailable and wrong-game items fail without partial output', function () use (&$fixture, $workshop) {
    reject(fn () => $workshop->resolve('101'));
    $fixture['102']['app'] = 440;
    reject(fn () => $workshop->resolve('100'));
    unset($fixture['102']['app']); $fixture['102']['result'] = 9;
    reject(fn () => $workshop->resolve('100'));
    unset($fixture['102']['result']);
});

$state = new State($panel . '/storage/app/gmod-toolkit-test-' . bin2hex(random_bytes(6)));
$state->write('settings', ['eggs' => [1]]);
$server = new Server(); $server->forceFill(['id' => 1, 'uuid' => '12345678-1234-1234-1234-123456789abc', 'owner_id' => 42, 'egg_id' => 1, 'node_id' => 1, 'status' => null]);
$node = new Node(); $node->forceFill(['id' => 1, 'fqdn' => 'na1.example.test', 'maintenance_mode' => false]);
$server->setRelation('node', $node); $server->setRelation('transfer', null);
$sub = new Subuser(); $sub->forceFill(['user_id' => 43, 'permissions' => ['file.read', 'file.read-content']]);
$server->setRelation('subusers', new Collection([$sub]));
$owner = user(42); $reader = user(43); $stranger = user(44); $admin = user(45, true);
$access = new Access($state);
test('real Panel policy: owner/admin, reader, missing permissions, unrelated server and egg allowlist', function () use ($state, $server, $access, $owner, $reader, $stranger, $admin, $sub) {
    foreach ([$owner, $admin] as $user) { $access->check(requestFor($user), $server, true); }
    $access->check(requestFor($reader), $server);
    reject(fn () => $access->check(requestFor(null), $server), 403);
    reject(fn () => $access->check(requestFor($reader), $server, true), 403);
    reject(fn () => $access->check(requestFor($stranger), $server), 403);
    $other = clone $server; $other->owner_id = 999; $other->setRelation('subusers', new Collection());
    reject(fn () => $access->check(requestFor($owner), $other), 403);
    $state->write('settings', ['eggs' => []]);
    reject(fn () => $access->check(requestFor($owner), $server), 404);
    $state->write('settings', ['eggs' => [1]]);
    $sub->permissions = ['file.read', 'file.read-content', 'file.create', 'file.update'];
    $access->check(requestFor($reader), $server, true);
});

class FakeWingsRepository extends \Pterodactyl\Repositories\Wings\DaemonFileRepository {
    public string $content = 'old Lua';
    public bool $link = false;
    public function __construct() {}
    public function getDirectory(string $path): array {
        $rows = [];
        foreach (['/garrysmod', '/garrysmod/lua', '/garrysmod/lua/autorun', '/garrysmod/lua/autorun/server'] as $directory) {
            if (dirname($directory) === $path) { $rows[] = ['name' => basename($directory), 'mode' => 'drwxr-xr-x', 'symlink' => false]; }
        }
        if ($path === dirname(WingsFiles::LUA)) { $rows[] = ['name' => basename(WingsFiles::LUA), 'mode' => '-rw-r--r--', 'size' => strlen($this->content), 'symlink' => $this->link]; }
        return $rows;
    }
    public function putContent(string $path, string $content): \Psr\Http\Message\ResponseInterface {
        same(WingsFiles::LUA, $path); $this->content = $content;
        return new \GuzzleHttp\Psr7\Response(204);
    }
    public function renameFiles(?string $root, array $files): \Psr\Http\Message\ResponseInterface { throw new RuntimeException('Wings does not replace existing rename destinations.'); }
    public function getHttpClient(array $headers = []): \GuzzleHttp\Client {
        return new \GuzzleHttp\Client(['handler' => function () { return \GuzzleHttp\Promise\Create::promiseFor(new \GuzzleHttp\Psr7\Response(200, [], $this->content)); }]);
    }
}
test('Wings file API contract replaces existing Lua, verifies writes and rejects symlinks', function () use ($server) {
    $repository = new FakeWingsRepository(); $files = new WingsFiles($repository);
    same('old Lua', $files->read($server));
    $files->write($server, 'new Lua'); same('new Lua', $files->read($server));
    $repository->link = true; reject(fn () => $files->read($server));
    $repository->link = false; $repository->content = "\xff\xfe";
    reject(fn () => $files->read($server));
});

class MemoryWings extends WingsFiles {
    public ?string $current = 'original user Lua';
    public int $writes = 0;
    public function __construct() {}
    public function read(Server $server): ?string { return $this->current; }
    public function write(Server $server, string $bytes): void { ++$this->writes; $this->current = $bytes; }
}
class FakeFastdl extends Fastdl {
    public array $calls = [];
    public function __construct() {}
    public function preview(Server $server, int $actor): array { $this->calls[] = [$server->uuid, $actor, 'preview']; return ['status' => 'running']; }
    public function prepare(Server $server): array { $this->calls[] = [$server->uuid, 'prepare']; return ['root' => '/fastdl']; }
    public function info(Server $server, int $actor): array { $this->calls[] = [$server->uuid, $actor, 'info']; return ['url' => null]; }
}
$files = new MemoryWings(); $fakeFastdl = new FakeFastdl();
$controller = new ToolkitController($access, $state, $files, $workshop, $fakeFastdl);
test('Workshop preview/apply/backup/restore, stale edits and actor binding', function () use ($controller, $owner, $reader, $server, $files, $state) {
    $preview = $controller->preview(requestFor($owner, ['collection' => '100']), $server)->getData(true);
    same('original user Lua', $preview['before']); same(0, $files->writes);
    reject(fn () => $controller->apply(requestFor($reader, ['preview' => $preview['preview']]), $server), 409);
    $files->current = 'concurrent edit';
    reject(fn () => $controller->apply(requestFor($owner, ['preview' => $preview['preview']]), $server), 409);
    $files->current = 'original user Lua';
    $controller->apply(requestFor($owner, ['preview' => $preview['preview']]), $server);
    same($preview['lua'], $files->current);
    $backups = $state->backups($server->uuid); same('original user Lua', $backups[0]['lua']);
    $restore = $controller->preview(requestFor($owner, ['backup' => $backups[0]['id']]), $server)->getData(true);
    same('original user Lua', $restore['lua']);
    $controller->apply(requestFor($owner, ['preview' => $restore['preview']]), $server);
    same('original user Lua', $files->current);
    reject(fn () => $controller->apply(requestFor($owner, ['preview' => $restore['preview']]), $server), 409);
});
test('FastDL calls are permission checked before publishing', function () use ($controller, $server, $sub, $reader, $stranger, $fakeFastdl) {
    $sub->permissions = ['file.read', 'file.read-content'];
    reject(fn () => $controller->fastdl(requestFor($stranger), $server, 'preview'), 403);
    reject(fn () => $controller->fastdl(requestFor($reader), $server, 'publish'), 403);
    reject(fn () => $controller->fastdl(requestFor($reader), $server, 'prepare'), 403);
    same([], $fakeFastdl->calls);
    $controller->fastdl(requestFor($reader), $server, 'preview');
    same([[$server->uuid, 43, 'preview']], $fakeFastdl->calls);
});
test('independent Workshop status never starts FastDL work and mounting guidance is removed', function () use ($controller, $server, $owner, $reader, $fakeFastdl) {
    $fakeFastdl->calls = [];
    $workshop = $controller->workshopStatus(requestFor($reader), $server)->getData(true);
    same([], $fakeFastdl->calls); same(false, isset($workshop['mounting'])); same(false, isset($workshop['fastdl']));
    same(true, isset($workshop['backups'], $workshop['target']));
    $fastdl = $controller->fastdlStatus(requestFor($reader), $server)->getData(true);
    same(['fastdl' => ['url' => null]], $fastdl);
    $result = $controller->fastdl(requestFor($owner), $server, 'prepare')->getData(true);
    same('/fastdl', $result['root']); same([$server->uuid, 'prepare'], end($fakeFastdl->calls));
});
test('existing membership and suspension middleware is retained', function () use ($server, $owner, $stranger) {
    $middleware = new \Pterodactyl\Http\Middleware\Api\Client\Server\AuthenticateServerAccess();
    $request = requestFor($owner);
    $route = new \Illuminate\Routing\Route('POST', '/servers/{server}/gmod-toolkit/workshop/apply', fn () => null);
    $route->bind($request); $route->setParameter('server', $server); $request->setRouteResolver(fn () => $route);
    same('ok', $middleware->handle($request, fn () => 'ok'));
    $request->setUserResolver(fn () => $stranger);
    reject(fn () => $middleware->handle($request, fn () => 'bad'), 404);
    $request->setUserResolver(fn () => $owner);
    $server->status = Server::STATUS_SUSPENDED;
    reject(fn () => $middleware->handle($request, fn () => 'bad'));
    $server->status = null;
});
test('real session CSRF and two-factor middleware deny invalid requests', function () use ($app, $owner) {
    $app['env'] = 'production';
    $request = requestFor($owner); $request->setLaravelSession($app['session']->driver()); $request->session()->start();
    $csrf = $app->make(\Pterodactyl\Http\Middleware\VerifyCsrfToken::class);
    reject(fn () => $csrf->handle($request, fn () => response('bad')));
    $request->headers->set('X-CSRF-TOKEN', $request->session()->token());
    same(200, $csrf->handle($request, fn () => response('ok'))->getStatusCode());
    $route = new \Illuminate\Routing\Route('POST', '/test', fn () => null); $route->name('gmod.test'); $request->setRouteResolver(fn () => $route);
    $app['config']->set('pterodactyl.auth.2fa_required', 2);
    $request->headers->set('Accept', 'application/json');
    $request->headers->set('Content-Type', 'application/json');
    reject(fn () => $app->make(\Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication::class)->handle($request, fn () => 'bad'));
    $app['config']->set('pterodactyl.auth.2fa_required', 0);
});
test('enabled-version guard rejects stale routes after disable/update', function () use ($app, $panel) {
    $host = new \AddonManager\Laravel\HostAdapter($app);
    $registry = new \AddonManager\Laravel\ExtensionRegistry($app, $host);
    $app->instance(\AddonManager\Laravel\ExtensionRegistry::class, $registry);
    $path = $host->stateRoot . '/registry.json';
    if (!is_dir(dirname($path))) mkdir(dirname($path), 0700, true);
    $manifest = json_decode(file_get_contents(dirname(__DIR__) . '/addon/manifest.json'), true);
    $record = ['version' => '1.2.0', 'manifest' => $manifest, 'enabled' => true];
    file_put_contents($path, json_encode(['addons' => ['gmod.toolkit' => $record]]));
    same('ok', (new Enabled())->handle(Request::create('/test'), fn () => 'ok'));
    $record['enabled'] = false;
    file_put_contents($path, json_encode(['addons' => ['gmod.toolkit' => $record]]));
    reject(fn () => (new Enabled())->handle(Request::create('/test'), fn () => 'bad'), 404);
    $record['enabled'] = true; $record['version'] = $record['manifest']['version'] = '1.3.0';
    file_put_contents($path, json_encode(['addons' => ['gmod.toolkit' => $record]]));
    reject(fn () => (new Enabled())->handle(Request::create('/test'), fn () => 'bad'), 404);
});
require __DIR__ . '/fastdl.php';
echo "$passed Panel/Workshop/FastDL tests passed. No real Wings/Steam requests were made.\n";
