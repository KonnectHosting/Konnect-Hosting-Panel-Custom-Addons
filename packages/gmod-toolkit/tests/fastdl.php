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

class AssetRepositoryFixture extends FakeWingsRepository {
    public bool $oversized = false;
    public bool $oversizedListing = false;
    public function getHttpClient(array $headers = []): \GuzzleHttp\Client {
        return new \GuzzleHttp\Client(['handler'=>function($request,$options){
            parse_str($request->getUri()->getQuery(),$query);
            if (str_ends_with($request->getUri()->getPath(),'/files/contents')) {
                return \GuzzleHttp\Promise\Create::promiseFor(new \GuzzleHttp\Psr7\Response(200,['Content-Length'=>'1'],$this->oversized?str_repeat('X',1024):'VBSP map'));
            }
            if($this->oversizedListing) return \GuzzleHttp\Promise\Create::promiseFor(new \GuzzleHttp\Psr7\Response(200,[],str_repeat('X',4194305)));
            $rows=match($query['directory']??'') {
                '/'=>[['name'=>'garrysmod','mode'=>'drwxr-xr-x']],
                '/garrysmod'=>[['name'=>'maps','mode'=>'drwxr-xr-x']],
                '/garrysmod/maps'=>[['name'=>'test.bsp','mode'=>'-rw-r--r--','size'=>8,'modified'=>'fixed','symlink'=>$this->link]],
                default=>[],
            };
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

test('manager guarded jobs resolve fresh actors and use the existing queue contract',function()use($app,$panel,$server){
    [$state,$source,$queue,$engine,$drain]=fastdlFixture();$app->instance(Fastdl::class,$engine);
    $manifest=json_decode(file_get_contents(dirname(__DIR__).'/addon/manifest.json'),true);
    file_put_contents($panel.'/storage/app/addon-manager/registry.json',json_encode(['addons'=>['gmod.toolkit'=>['version'=>'1.1.1','manifest'=>$manifest,'enabled'=>true]]]));
    $engine->preview($server,42);
    $extensions=$app->make(\AddonManager\Laravel\ExtensionRegistry::class);$count=0;
    while(count($queue)){
        if(++$count>100)throw new RuntimeException('Unbounded guarded queue chain');
        $payload=$queue[0];$queue->offsetUnset(0);$queue->exchangeArray(array_values($queue->getArrayCopy()));
        $extensions->runJob('gmod.toolkit','1.1.1','fastdl-step',$payload);
    }
    same('preview-ready',$engine->info($server,42)['job']['status']);
});

// Exercise the anonymous public route through the real HTTP kernel and its guard.
test('anonymous HTTP FastDL is limited to enabled approved asset snapshots', function () use ($app,$panel,$server) {
    [$state,$source,$queue,$engine,$drain] = fastdlFixture(); $token = published($engine,$drain);
    $app->instance(Fastdl::class,$engine);
    $manifest = json_decode(file_get_contents(dirname(__DIR__) . '/addon/manifest.json'),true);
    $registry = $panel . '/storage/app/addon-manager/registry.json';
    file_put_contents($registry,json_encode(['addons'=>['gmod.toolkit'=>['version'=>'1.1.1','manifest'=>$manifest,'enabled'=>true]]]));
    $kernel=$app->make(\Illuminate\Contracts\Http\Kernel::class);
    $request=\Illuminate\Http\Request::create('/fastdl/'.$token.'/maps/test.bsp','GET');
    $response=$kernel->handle($request); same(200,$response->getStatusCode()); same('application/octet-stream',$response->headers->get('Content-Type'));
    ob_start();$response->sendContent();$bytes=ob_get_clean();same('VBSP map',$bytes);
    $response=$kernel->handle(\Illuminate\Http\Request::create('/fastdl/'.$token.'/cfg/server.cfg','GET'));same(404,$response->getStatusCode());
    file_put_contents($registry,json_encode(['addons'=>[]]));
    $response=$kernel->handle(\Illuminate\Http\Request::create('/fastdl/'.$token.'/maps/test.bsp','GET'));same(404,$response->getStatusCode());
});
