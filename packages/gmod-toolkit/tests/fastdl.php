<?php
declare(strict_types=1);

use Pterodactyl\Addons\GmodToolkit\{AssetPolicy,AssetSource,Access,State,Fastdl};
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;

// Minimal synthetic DB for real public-route model lookups; never production.
$app['config']->set('database.default', 'gmodtest');
$app['config']->set('database.connections.gmodtest', ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '']);
$db = $app['db']->connection('gmodtest');
$db->statement('CREATE TABLE servers (id INTEGER PRIMARY KEY, uuid TEXT, owner_id INTEGER, egg_id INTEGER, node_id INTEGER, status TEXT)');
$db->statement('CREATE TABLE nodes (id INTEGER PRIMARY KEY, fqdn TEXT, maintenance_mode INTEGER)');
$db->statement('CREATE TABLE eggs (id INTEGER PRIMARY KEY, name TEXT, startup TEXT)');
$db->statement('CREATE TABLE allocations (id INTEGER PRIMARY KEY)');
$db->statement('CREATE TABLE server_transfers (id INTEGER PRIMARY KEY, server_id INTEGER, successful INTEGER)');
$db->statement('CREATE TABLE users (id INTEGER PRIMARY KEY, root_admin INTEGER, use_totp INTEGER)');
$db->table('servers')->insert(['id' => 1, 'uuid' => $server->uuid, 'owner_id' => 42, 'egg_id' => 1, 'node_id' => 1]);
$db->table('nodes')->insert(['id' => 1, 'fqdn' => 'node.example.test', 'maintenance_mode' => 0]);
$db->table('eggs')->insert(['id' => 1, 'name' => "Garry's Mod", 'startup' => './srcds_run -game garrysmod']);
$db->table('users')->insert(['id' => 42, 'root_admin' => 0, 'use_totp' => 0]);
$app['config']->set('queue.default', 'redis');
$app['config']->set('app.url', 'https://panel.example.test');
$app['url']->forceRootUrl('https://panel.example.test'); $app['url']->forceScheme('https');

class MemoryAssets extends AssetSource {
    public array $files = ['maps/test.bsp' => 'VBSP map', 'materials/test.vmt' => 'LightmappedGeneric {}',
        'lua/secret.lua' => 'secret', 'cfg/server.cfg' => 'rcon_password secret', 'addons/private.gma' => 'archive'];
    public int $copies = 0;
    public bool $fail = false;
    public function __construct() {}
    public function listing(Server $server, string $relative): array {
        $rows = [];
        foreach ($this->files as $path => $bytes) {
            $prefix = $relative === '' ? '' : $relative . '/';
            if (!str_starts_with($path, $prefix)) continue;
            $tail = substr($path, strlen($prefix)); $parts = explode('/', $tail); $name = $parts[0];
            $rows[$name] = count($parts) > 1 ? ['name' => $name, 'mode' => 'drwxr-xr-x', 'symlink' => false]
                : ['name' => $name, 'mode' => '-rw-r--r--', 'size' => strlen($bytes), 'modified' => 'fixed', 'symlink' => false];
        }
        if ($relative === 'maps') { $rows['link.bsp'] = ['name' => 'link.bsp', 'mode' => 'Lrwxrwxrwx', 'symlink' => true, 'size' => 8]; }
        return array_values($rows);
    }
    public function copy(Server $server, string $relative, array $expected, string $target): array {
        ++$this->copies;
        if ($this->fail || !isset($this->files[$relative]) || strlen($this->files[$relative]) !== $expected['bytes']) { throw new RuntimeException('Asset changed during transfer.'); }
        file_put_contents($target, $this->files[$relative]); chmod($target, 0600);
        return ['bytes' => strlen($this->files[$relative]), 'sha256' => hash('sha256', $this->files[$relative]), 'object' => hash('sha256', $relative)];
    }
}

function fastdlFixture(): array {
    global $panel, $server, $owner;
    $state = new State($panel . '/storage/app/fastdl-test-' . bin2hex(random_bytes(6)));
    $state->write('settings', ['eggs' => [1]]);
    $source = new MemoryAssets(); $queue = new ArrayObject();
    $engine = new Fastdl($state, $source, new Access($state), static function (array $payload) use ($queue) { $queue[] = $payload; });
    $drain = static function (?Server $target = null) use ($engine, $queue, $server, $owner): void {
        $count = 0;
        while (count($queue)) {
            if (++$count > 100) throw new RuntimeException('Unbounded queue chain');
            $payload = $queue[0]; $queue->offsetUnset(0); $queue->exchangeArray(array_values($queue->getArrayCopy()));
            $engine->step($target ?? $server, $owner, $payload);
        }
    };
    return [$state, $source, $queue, $engine, $drain];
}
function readyPreview(Fastdl $engine, callable $drain): array {
    global $server, $owner;
    $engine->preview($server, $owner->id); $drain();
    $info = $engine->info($server, $owner->id);
    same('preview-ready', $info['job']['status']);
    return $info['preview'];
}
function published(Fastdl $engine, callable $drain): string {
    global $server, $owner;
    $preview = readyPreview($engine, $drain);
    $engine->publish($server, $owner->id, $preview['preview']); $drain();
    $info = $engine->info($server, $owner->id);
    same('complete', $info['job']['status']);
    return basename(rtrim($info['url'], '/'));
}

test('GMod eggs recognized automatically without admin provisioning', function () use ($server, $panel, $db) {
    $state = new State($panel . '/storage/app/autodetect-' . bin2hex(random_bytes(6)));
    $access = new Access($state);
    same(true, $access->eligible(Server::find(1)));
    $db->table('eggs')->where('id', 1)->update(['name' => 'Minecraft', 'startup' => 'java -jar server.jar']);
    same(false, $access->eligible(Server::find(1)));
    $db->table('eggs')->where('id', 1)->update(['name' => "Garry's Mod", 'startup' => './srcds_run -game garrysmod']);
});
test('Panel FastDL strict allowlist rejects private content and paths', function () {
    foreach (['maps/a.bsp','materials/a.vmt','models/a.dx90.vtx','sound/a.wav','particles/a.pcf','resource/fonts/a.ttf'] as $path) same(true, AssetPolicy::path($path));
    foreach (['lua/a.lua','cfg/server.cfg','.env','addons/a.gma','maps/a.bsp.bz2','maps/../a.bsp','maps/private.bsp','maps/a.zip','maps/.hidden.bsp','maps/a%2fb.bsp','maps/a\\b.bsp'] as $path) same(false, AssetPolicy::path($path));
});
test('queued snapshots, exact previews, Panel URLs and bzip2 round trip', function () use ($server, $owner) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture();
    $engine->preview($server, $owner->id); same(0, $source->copies); same(1, count($queue)); $drain();
    $preview = $engine->info($server, 42)['preview'];
    same(['maps/test.bsp','materials/test.vmt'], $preview['added']); same(2, $preview['files']);
    $engine->publish($server, 42, $preview['preview']); $drain();
    $info = $engine->info($server, 42); same('complete', $info['job']['status']);
    same(true, str_starts_with($info['url'], 'https://panel.example.test/fastdl/'));
    $token = basename(rtrim($info['url'], '/'));
    $raw = $engine->download($token, 'maps/test.bsp'); same('VBSP map', file_get_contents($raw['path']));
    $compressed = $engine->download($token, 'maps/test.bsp.bz2');
    $process = new \Symfony\Component\Process\Process(['/usr/bin/python3','-c','import bz2,sys;sys.stdout.buffer.write(bz2.open(sys.argv[1],"rb").read())',$compressed['path']]);
    $process->mustRun(); same('VBSP map', $process->getOutput());
    foreach (['lua/secret.lua','cfg/server.cfg','addons/private.gma','../settings.json'] as $path) reject(fn () => $engine->download($token, $path), 404);
});
test('public downloads survive game stop and reject rotated/revoked URLs', function () use ($server) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture(); $token = published($engine, $drain);
    $new = $engine->rotate($server, false); $second = basename(rtrim($new['url'], '/')); same(false, $token === $second);
    reject(fn () => $engine->download($token, 'maps/test.bsp'), 404);
    same('VBSP map', file_get_contents($engine->download($second, 'maps/test.bsp')['path']));
    $engine->rotate($server, true); reject(fn () => $engine->download($second, 'maps/test.bsp'), 404);
});
test('FastDL uses canonical Panel URL rather than the request Host header', function () use ($app,$server) {
    [$state,$source,$queue,$engine,$drain]=fastdlFixture();published($engine,$drain);
    $app['url']->forceRootUrl('https://untrusted.example.test');
    same(true,str_starts_with($engine->info($server,42)['url'],'https://panel.example.test/fastdl/'));
    $app['url']->forceRootUrl('https://panel.example.test');
});
test('random per-server URLs never expose another server snapshot', function () use ($server,$db) {
    [$state,$source,$queue,$engine,$drain] = fastdlFixture(); $first = published($engine,$drain);
    $other = clone $server; $other->id=2; $other->uuid='87654321-1234-1234-1234-123456789abc';
    $db->table('servers')->insert(['id'=>2,'uuid'=>$other->uuid,'owner_id'=>42,'egg_id'=>1,'node_id'=>1]);
    $source->files['maps/second.bsp']='second server map';
    $engine->preview($other,42);$drain($other);$preview=$engine->info($other,42)['preview'];
    $engine->publish($other,42,$preview['preview']);$drain($other);
    $second=basename(rtrim($engine->info($other,42)['url'],'/'));same(false,$first===$second);
    reject(fn()=>$engine->download($first,'maps/second.bsp'),404);
    same('second server map',file_get_contents($engine->download($second,'maps/second.bsp')['path']));
    $db->table('servers')->where('id',2)->delete();
});
test('preview actor binding, expiry and queue replay protection', function () use ($server, $owner) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture();
    $engine->preview($server, 42); $payload = $queue[0]; $engine->step($server, $owner, $payload);
    $r = $state->read('fastdl-server-' . $server->uuid); $sequence = $r['job']['sequence'];
    $engine->step($server, $owner, $payload); same($sequence, $state->read('fastdl-server-' . $server->uuid)['job']['sequence']);
    $drain(); $preview = $engine->info($server, 42)['preview'];
    reject(fn () => $engine->publish($server, 43, $preview['preview']), 409);
    $r = $state->read('fastdl-server-' . $server->uuid); $r['job']['expires'] = 0; $state->write('fastdl-server-' . $server->uuid, $r);
    reject(fn () => $engine->publish($server, 42, $preview['preview']), 409);
});
test('approved snapshots ignore later source edits; failed rebuild keeps old publication', function () use ($server) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture(); $token = published($engine, $drain);
    $preview = readyPreview($engine, $drain); $source->files['maps/test.bsp'] = 'different live bytes';
    $engine->publish($server, 42, $preview['preview']); $drain();
    same('VBSP map', file_get_contents($engine->download($token, 'maps/test.bsp')['path']));
    $source->fail = true; $engine->preview($server, 42); $drain();
    same('failed', $engine->info($server, 42)['job']['status']);
    same('VBSP map', file_get_contents($engine->download($token, 'maps/test.bsp')['path']));
});
test('snapshot tampering and in-flight revocation cannot replace publication', function () use ($server) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture(); $token = published($engine, $drain);
    $preview = readyPreview($engine, $drain); $r = $state->read('fastdl-server-' . $server->uuid);
    file_put_contents($state->object($r['job']['snapshot'], hash('sha256','maps/test.bsp')), 'tampered');
    $engine->publish($server, 42, $preview['preview']); $drain(); same('failed', $engine->info($server, 42)['job']['status']);
    same('VBSP map', file_get_contents($engine->download($token, 'maps/test.bsp')['path']));
    $preview = readyPreview($engine, $drain); $engine->publish($server, 42, $preview['preview']); $engine->rotate($server, true); $drain();
    same(null, $engine->info($server, 42)['url']);
});
test('public downloads stop for suspension, deleted servers and disabled eggs', function () use ($server, $db) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture(); $token = published($engine, $drain);
    $db->table('servers')->where('id',1)->update(['status' => Server::STATUS_SUSPENDED]); reject(fn () => $engine->download($token,'maps/test.bsp'),404);
    $db->table('servers')->where('id',1)->update(['status' => null]);
    $state->write('settings',['eggs' => []]); reject(fn () => $engine->download($token,'maps/test.bsp'),404);
    $state->write('settings',['eggs' => [1]]);
    $db->table('servers')->where('id',1)->delete(); reject(fn () => $engine->download($token,'maps/test.bsp'),404);
    $db->table('servers')->insert(['id' => 1, 'uuid' => $server->uuid, 'owner_id' => 42, 'egg_id' => 1, 'node_id' => 1]);
});
test('queued work rechecks permissions and recovers interrupted steps', function () use ($server, $owner) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture();
    $engine->preview($server, 42); $queue->exchangeArray([]);
    $r = $state->read('fastdl-server-' . $server->uuid); $r['job']['updated'] = time()-120; $state->write('fastdl-server-' . $server->uuid,$r);
    $engine->info($server,42); same(1,count($queue));
    $engine->info($server,42); same(1,count($queue)); // Polling does not flood the queue.
    $drain(); same('preview-ready',$engine->info($server,42)['job']['status']);
    $preview = $engine->info($server,42)['preview']; $engine->publish($server,42,$preview['preview']);
    $server->owner_id = 999;
    $drain(); same('failed',$engine->info($server,42)['job']['status']); same(null,$engine->info($server,42)['url']);
    $server->owner_id = 42;
});
test('scan status distinguishes pending work and recovery cannot hide a stalled queue', function () use ($server) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture();
    $engine->preview($server, 42);
    $info = $engine->info($server, 42);
    same(0, $info['job']['inspected']); same(1, $info['job']['pendingDirectories']); same(false, $info['job']['waiting']);
    $key = 'fastdl-server-' . $server->uuid;
    $r = $state->read($key); $r['job']['updated'] = time() - 120; unset($r['job']['progressed']); $state->write($key, $r);
    same(true, $engine->info($server, 42)['job']['waiting']);
    same(true, $engine->info($server, 42)['job']['waiting']);
    $drain(); same(false, $engine->info($server, 42)['job']['waiting']);
    $engine->preview($server, 42); $r = $state->read($key); $snapshot = $state->directory($r['job']['snapshot']);
    $r['job']['expires'] = time() - 1; $state->write($key, $r);
    $info = $engine->info($server, 42);
    same('failed', $info['job']['status']); same(true, str_contains($info['job']['message'], 'timed out'));
    same(false, is_dir($snapshot));
});
test('enqueue failures leave a retryable failure rather than a permanently running scan', function () use ($server, $panel) {
    $state = new State($panel . '/storage/app/failed-enqueue-' . bin2hex(random_bytes(6)));
    $engine = new Fastdl($state, new MemoryAssets(), new Access($state), static function (array $payload): void { throw new RuntimeException('Synthetic queue outage'); });
    reject(fn () => $engine->preview($server, 42));
    $info = $engine->info($server, 42);
    same('failed', $info['job']['status']); same(true, str_contains($info['job']['message'], 'could not accept'));
    reject(fn () => $engine->preview($server, 42));
    same('failed', $engine->info($server, 42)['job']['status']);
});

class AssetRepositoryFixture extends FakeWingsRepository {
    public bool $oversized = false;
    public bool $oversizedListing = false;
    public bool $rootLink = false;
    public bool $innerLink = false;
    public array $requests = [];
    public array $created = [];
    public array $directories = [
        '/' => [['name' => 'fastdl', 'mode' => 'drwxr-xr-x'], ['name' => 'garrysmod', 'mode' => 'drwxr-xr-x']],
        '/fastdl' => [['name' => 'maps', 'mode' => 'drwxr-xr-x']],
        '/fastdl/maps' => [['name' => 'test.bsp', 'mode' => '-rw-r--r--', 'size' => 8, 'modified' => 'fixed']],
        '/garrysmod/maps' => [['name' => 'unrelated.bsp', 'mode' => '-rw-r--r--', 'size' => 8, 'modified' => 'fixed']],
    ];
    public function createDirectory(string $name, string $path): \Psr\Http\Message\ResponseInterface {
        $this->created[] = [$name, $path];
        $this->directories[$path][] = ['name' => $name, 'mode' => 'drwxr-xr-x'];
        $this->directories[rtrim($path, '/') . '/' . $name] = [];
        return new \GuzzleHttp\Psr7\Response(204);
    }
    public function getHttpClient(array $headers = []): \GuzzleHttp\Client {
        return new \GuzzleHttp\Client(['handler'=>function($request,$options){
            parse_str($request->getUri()->getQuery(),$query);
            $this->requests[] = $query['file'] ?? $query['directory'] ?? '';
            if (str_ends_with($request->getUri()->getPath(),'/files/contents')) {
                same('/fastdl/maps/test.bsp', $query['file']);
                return \GuzzleHttp\Promise\Create::promiseFor(new \GuzzleHttp\Psr7\Response(200,['Content-Length'=>'1'],$this->oversized?str_repeat('X',1024):'VBSP map'));
            }
            if($this->oversizedListing) return \GuzzleHttp\Promise\Create::promiseFor(new \GuzzleHttp\Psr7\Response(200,[],str_repeat('X',4194305)));
            $path = $query['directory'] ?? ''; $rows = $this->directories[$path] ?? [];
            foreach ($rows as &$row) {
                if (($path === '/' && $row['name'] === 'fastdl' && $this->rootLink)
                    || ($path === '/fastdl' && $row['name'] === 'maps' && $this->innerLink)
                    || ($path === '/fastdl/maps' && $this->link)) { $row['symlink'] = true; }
            }
            unset($row);
            return \GuzzleHttp\Promise\Create::promiseFor(new \GuzzleHttp\Psr7\Response(200,[],json_encode($rows)));
        }]);
    }
}
test('existing Wings API streams assets with size, ancestry and link checks',function()use($server,$panel){
    $repository=new AssetRepositoryFixture();$source=new AssetSource($repository);
    $expected=['bytes'=>8,'modified'=>'fixed'];$target=$panel.'/storage/app/asset-source-'.bin2hex(random_bytes(8));
    $info=$source->copy($server,'maps/test.bsp',$expected,$target);same(hash('sha256','VBSP map'),$info['sha256']);unlink($target);
    $repository->oversized=true;reject(fn()=>$source->copy($server,'maps/test.bsp',$expected,$target));@unlink($target);
    $repository->oversized=false;$repository->link=true;reject(fn()=>$source->copy($server,'maps/test.bsp',$expected,$target));
    $repository->oversizedListing=true;reject(fn()=>$source->listing($server,''));
});

test('only dedicated FastDL uploads are read; game folders and linked roots are excluded', function () use ($server, $panel) {
    $repository = new AssetRepositoryFixture(); $source = new AssetSource($repository);
    $state = new State($panel . '/storage/app/dedicated-root-' . bin2hex(random_bytes(6)));
    $state->write('settings', ['eggs' => [1]]); $queue = new ArrayObject();
    $engine = new Fastdl($state, $source, new Access($state), function ($payload) use ($queue) { $queue[] = $payload; });
    $engine->preview($server, 42);
    foreach ($queue as $payload) { $engine->handle($payload); }
    $info = $engine->info($server, 42);
    same('preview-ready', $info['job']['status']); same(['maps/test.bsp'], $info['preview']['added']);
    foreach ($repository->requests as $path) { same(true, $path === '/' || $path === '/fastdl' || str_starts_with($path, '/fastdl/')); }
    $repository->rootLink = true; reject(fn () => $source->listing($server, ''));
    reject(fn () => $source->prepare($server)); same([], $repository->created);
    $repository->rootLink = false; $repository->innerLink = true;
    reject(fn () => $source->listing($server, 'maps')); reject(fn () => $source->prepare($server));
    foreach (['../garrysmod', '/garrysmod', 'maps/../cfg', 'maps//test'] as $relative) { reject(fn () => $source->listing($server, $relative)); }
});

test('upload folders are created through existing Wings calls without touching game assets', function () use ($server) {
    $repository = new AssetRepositoryFixture();
    $repository->directories = ['/' => [['name' => 'garrysmod', 'mode' => 'drwxr-xr-x']], '/garrysmod' => [['name' => 'unrelated.bsp', 'mode' => '-rw-r--r--']]];
    $source = new AssetSource($repository); $result = $source->prepare($server);
    same('/fastdl', $result['root']); same(8, count($repository->created));
    same([['name' => 'unrelated.bsp', 'mode' => '-rw-r--r--']], $repository->directories['/garrysmod']);
    $source->prepare($server); same(8, count($repository->created));
    same(true, array_key_exists('/fastdl/resource/fonts', $repository->directories));
    $repository->directories['/'][1] = ['name' => 'fastdl', 'mode' => '-rw-r--r--'];
    reject(fn () => $source->prepare($server));
});

test('older unfinished previews are retired while existing published downloads remain available', function () use ($server) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture(); $token = published($engine, $drain);
    $preview = readyPreview($engine, $drain); $key = 'fastdl-server-' . $server->uuid;
    $r = $state->read($key); unset($r['job']['sourceRoot']); $state->write($key, $r);
    reject(fn () => $engine->publish($server, 42, $preview['preview']), 409);
    $info = $engine->info($server, 42); same('failed', $info['job']['status']);
    same('VBSP map', file_get_contents($engine->download($token, 'maps/test.bsp')['path']));
    $preview = readyPreview($engine, $drain); same(2, $preview['files']);
});

test('thousands of explicitly uploaded assets are enumerated without reading game files', function () use ($server, $owner) {
    [$state, $source, $queue, $engine, $drain] = fastdlFixture(); $source->files = [];
    for ($i = 0; $i < 2500; ++$i) { $source->files['materials/test' . $i . '.vtf'] = 'VTF'; }
    $engine->preview($server, 42);
    for ($i = 0; $i < 2; ++$i) { $engine->step($server, $owner, $queue[$i]); }
    $info = $engine->info($server, 42); same(2500, $info['job']['total']); same(0, $source->copies);
});

test('manager guarded jobs resolve fresh actors and use the existing queue contract',function()use($app,$panel,$server){
    [$state,$source,$queue,$engine,$drain]=fastdlFixture();$app->instance(Fastdl::class,$engine);
    $manifest=json_decode(file_get_contents(dirname(__DIR__).'/addon/manifest.json'),true);
    file_put_contents($panel.'/storage/app/addon-manager/registry.json',json_encode(['addons'=>['gmod.toolkit'=>['version'=>'1.5.0','manifest'=>$manifest,'enabled'=>true]]]));
    $engine->preview($server,42);
    $extensions=$app->make(\AddonManager\Laravel\ExtensionRegistry::class);$count=0;
    while(count($queue)){
        if(++$count>100)throw new RuntimeException('Unbounded guarded queue chain');
        $payload=$queue[0];$queue->offsetUnset(0);$queue->exchangeArray(array_values($queue->getArrayCopy()));
        $extensions->runJob('gmod.toolkit','1.5.0','fastdl-step',$payload);
    }
    same('preview-ready',$engine->info($server,42)['job']['status']);
});

test('real bus serialization and standard queue execute the complete FastDL workflow', function () use ($app, $panel, $server, $db) {
    $db->statement('CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, queue TEXT, payload TEXT, attempts INTEGER, reserved_at INTEGER, available_at INTEGER, created_at INTEGER)');
    $app['config']->set('queue.connections.gmodqueue', ['driver' => 'database', 'connection' => 'gmodtest', 'table' => 'jobs', 'queue' => 'standard', 'retry_after' => 90, 'after_commit' => false]);
    $app['config']->set('queue.default', 'gmodqueue');
    try {
        $state = new State($panel . '/storage/app/bus-test-' . bin2hex(random_bytes(6)));
        $state->write('settings', ['eggs' => [1]]);
        $engine = new Fastdl($state, new MemoryAssets(), new Access($state));
        $app->instance(Fastdl::class, $engine);
        $manifest = json_decode(file_get_contents(dirname(__DIR__) . '/addon/manifest.json'), true);
        file_put_contents($panel . '/storage/app/addon-manager/registry.json', json_encode(['addons' => ['gmod.toolkit' => ['version' => $manifest['version'], 'manifest' => $manifest, 'enabled' => true]]]));
        $queue = $app['queue']->connection('gmodqueue');
        $drain = static function () use ($queue): void {
            $count = 0;
            while ($job = $queue->pop('standard')) {
                if (++$count > 100) { throw new RuntimeException('Unbounded real queue chain'); }
                $job->fire(); $job->delete();
            }
        };
        $engine->preview($server, 42); same(1, $queue->size('standard'));
        $drain(); $preview = $engine->info($server, 42)['preview']; same(2, $preview['files']);
        $engine->publish($server, 42, $preview['preview']); $drain();
        same('complete', $engine->info($server, 42)['job']['status']);
        $engine->preview($server, 42); $drain(); $preview = $engine->info($server, 42)['preview'];
        $engine->buildAddon($server, 42, $preview['preview'], ['name' => 'Queued Workshop package', 'description' => 'Native manager job']);
        $drain(); same('addon-ready', $engine->info($server, 42)['job']['status']);
        same(0, $queue->size('standard'));
    } finally { $app['config']->set('queue.default', 'redis'); }
});

// Exercise the anonymous public route through the real HTTP kernel and its guard.
test('anonymous HTTP FastDL is limited to enabled approved asset snapshots', function () use ($app,$panel,$server) {
    [$state,$source,$queue,$engine,$drain] = fastdlFixture(); $token = published($engine,$drain);
    $app->instance(Fastdl::class,$engine);
    $manifest = json_decode(file_get_contents(dirname(__DIR__) . '/addon/manifest.json'),true);
    $registry = $panel . '/storage/app/addon-manager/registry.json';
    file_put_contents($registry,json_encode(['addons'=>['gmod.toolkit'=>['version'=>'1.5.0','manifest'=>$manifest,'enabled'=>true]]]));
    $kernel=$app->make(\Illuminate\Contracts\Http\Kernel::class);
    $request=\Illuminate\Http\Request::create('/fastdl/'.$token.'/maps/test.bsp','GET');
    $response=$kernel->handle($request); same(200,$response->getStatusCode()); same('application/octet-stream',$response->headers->get('Content-Type'));
    ob_start();$response->sendContent();$bytes=ob_get_clean();same('VBSP map',$bytes);
    $response=$kernel->handle(\Illuminate\Http\Request::create('/fastdl/'.$token.'/cfg/server.cfg','GET'));same(404,$response->getStatusCode());
    file_put_contents($registry,json_encode(['addons'=>[]]));
    $response=$kernel->handle(\Illuminate\Http\Request::create('/fastdl/'.$token.'/maps/test.bsp','GET'));same(404,$response->getStatusCode());
});
