<?php
declare(strict_types=1);

use Pterodactyl\Addons\GmodToolkit\{ScannerSource,BackdoorScanner,ScannerController,ScanScope};

class MemoryScanFiles extends ScannerSource {
    public array $files = [
        '/garrysmod/addons/example/lua/server.lua' => 'net.Receive("test", function() RunString(net.ReadString()) end)',
        '/garrysmod/lua/safe.lua' => 'print("hello")',
        '/garrysmod/data/hidden.txt' => 'CompileString(file.Read("hidden.vmt"))',
    ];
    public ?Closure $onCopy = null;
    public bool $fail = false;
    public int $copies = 0;
    public array $listed = [];
    public array $copied = [];
    public array $sizes = [];
    public string $modified = 'fixed';
    public array $links = [];
    public function available(\Pterodactyl\Models\Server $server, string $root): bool {
        foreach($this->files as $file=>$content){if(str_starts_with($file,$root.'/')){return true;}}
        return false;
    }
    public function __construct() {}
    public function listing(\Pterodactyl\Models\Server $server, string $path): array {
        $this->listed[] = $path;
        $rows = [];
        foreach ($this->files as $file => $content) {
            $prefix = rtrim($path, '/') . '/';
            if (!str_starts_with($file, $prefix)) { continue; }
            $parts = explode('/', substr($file, strlen($prefix))); $name = $parts[0];
            $rows[$name] = count($parts) > 1 ? ['name' => $name, 'mode' => 'drwxr-xr-x'] : ['name' => $name, 'mode' => '-rw-r--r--', 'size' => $this->sizes[$file] ?? strlen($content), 'modified' => $this->modified];
        }
        foreach($rows as $name=>&$row){if(isset($this->links[rtrim($path,'/').'/'.$name])){$row['is_symlink']=true;}}unset($row);
        return array_values($rows);
    }
    public function copy(\Pterodactyl\Models\Server $server, string $path, array $expected, string $target): void {
        ++$this->copies; $this->copied[]=$path;
        if ($this->onCopy) { ($this->onCopy)(); }
        if ($this->fail || !isset($this->files[$path]) || strlen($this->files[$path]) !== $expected['bytes']) { throw new RuntimeException('File changed.'); }
        file_put_contents($target, $this->files[$path]); chmod($target, 0600);
    }
}

function scannerFixture(): array {
    global $panel, $server, $owner;
    $state = new \Pterodactyl\Addons\GmodToolkit\State($panel . '/storage/app/scanner-test-' . bin2hex(random_bytes(6)));
    $state->write('settings', ['eggs' => [1]]); $source = new MemoryScanFiles(); $queue = new ArrayObject();
    $scanner = new BackdoorScanner($state, $source, new \Pterodactyl\Addons\GmodToolkit\Access($state), static function ($payload) use ($queue) { $queue[] = $payload; });
    $drain = static function () use ($scanner, $queue, $server, $owner): void {
        $limit = 500;
        while (count($queue)) {
            if (--$limit < 0) { throw new RuntimeException('Scanner queue did not finish.'); }
            $payload = $queue[0]; $queue->offsetUnset(0); $queue->exchangeArray(array_values($queue->getArrayCopy()));
            $scanner->step($server, $owner, $payload);
        }
    };
    return [$state, $source, $queue, $scanner, $drain];
}

test('scanner uses asynchronous read-only work, finds loose addon/data Lua and persists private reports', function () use ($server, $owner) {
    [$state,$source,$queue,$scanner,$drain] = scannerFixture(); $before = $source->files;
    $scanner->start($server, $owner->id, false, false, ScanScope::CODE); same(0, $source->copies); same(1, count($queue)); $drain();
    $report = $scanner->info($server)['scan']; same('complete', $report['status']); same(3, $report['filesScanned']);
    same(false, $report['partial']); same($before, $source->files);
    same(true, in_array('network-execution', array_column($report['findings'], 'rule'), true));
    same(true, in_array('file-execution', array_column($report['findings'], 'rule'), true));
    $other = clone $server; $other->uuid = '87654321-1234-1234-1234-123456789abc'; same(null, $scanner->info($other)['scan']);
    $record = $state->read('scanner-server-' . $server->uuid);
    same(false, is_dir(dirname($state->object('probe', hash('sha256', 'x'))) . '/../' . $record['snapshot']));
    same(0, fileperms(dirname(dirname($state->object('probe', hash('sha256', 'x')))) . '/scanner-server-' . $server->uuid . '.json') & 0077);
});

test('scanner inspects GMA contents without extraction and reports unsupported/unreadable files as incomplete', function () use ($server, $owner) {
    [$state,$source,$queue,$scanner,$drain] = scannerFixture();
    $raw = 'RunString(net.ReadString())'; $name = 'lua/autorun/server/payload.lua';
    $gma = 'GMAD' . chr(3) . str_repeat("\0",16) . "\0Test\0{}\0Fixture\0" . pack('V',1)
        . pack('V',1) . $name . "\0" . pack('P',strlen($raw)) . pack('V',crc32($raw)) . pack('V',0) . $raw;
    $gma .= pack('V',crc32($gma));
    $source->files = ['/garrysmod/addons/packed.gma'=>$gma, '/garrysmod/addons/unreadable.zip'=>'zip', '/steamapps/workshop/content/4000/1/item.bin'=>'unsupported'];
    $scanner->start($server,42,true,false,ScanScope::roots(true)); $drain(); $report = $scanner->info($server)['scan'];
    same('complete', $report['status']); same(true,$report['partial']); same(true,$report['uninspected']>=2);
    same($name, $report['findings'][0]['member']); same('/garrysmod/addons/packed.gma',$report['findings'][0]['file']);
    same(true,in_array('network-execution',array_column($report['findings'],'rule'),true));
});

test('scanner permissions guard reports/start/cancel and queued work rechecks authorization', function () use ($server,$owner,$reader,$stranger) {
    [$state,$source,$queue,$scanner,$drain] = scannerFixture();
    $controller = new ScannerController(new \Pterodactyl\Addons\GmodToolkit\Access($state),$scanner);
    foreach (['status','start','cancel'] as $action) { reject(fn () => $controller->$action(requestFor($stranger),$server),403); }
    same(null,$controller->status(requestFor($reader),$server)->getData(true)['scan']);
    $scanner->start($server,42,false,false,ScanScope::CODE); $payload=$queue[0];
    $other=clone $server; $other->owner_id=999; $other->setRelation('subusers',new \Illuminate\Database\Eloquent\Collection());
    $scanner->step($other,$owner,$payload); same('failed',$scanner->info($server)['scan']['status']); same(0,$source->copies);
});

test('scanner report limits retain late critical evidence rather than earlier routine findings', function () use ($server) {
    [$state,$source,$queue,$scanner,$drain] = scannerFixture(); $source->files=[];
    for($i=0;$i<20;++$i){$source->files['/garrysmod/addons/a'.$i.'.lua']=str_repeat("RunString(value)\n",30);}
    $source->files['/garrysmod/addons/z-critical.lua']='RunString(net.ReadString())';
    $scanner->start($server,42,false,false,ScanScope::CODE);$drain();$report=$scanner->info($server)['scan'];
    same(500,count($report['findings'])); same(true,$report['truncated']); same(true,$report['partial']);
    same(true,in_array('critical',array_column($report['findings'],'severity'),true));
});

test('scanner replay, cancellation, recovery, expiry and changing files cannot produce a false complete report', function () use ($server,$owner) {
    [$state,$source,$queue,$scanner,$drain] = scannerFixture();
    $scanner->start($server,42,false,false,ScanScope::CODE); $first=$queue[0]; $drain(); $copies=$source->copies;
    $scanner->step($server,$owner,$first); same($copies,$source->copies);
    $scanner->start($server,42,false,false,ScanScope::CODE); $cancelled=$queue[0]; $scanner->cancel($server); $drain();
    same('cancelled',$scanner->info($server)['scan']['status']); same(true,$scanner->info($server)['scan']['partial']);
    $scanner->start($server,42,false,false,ScanScope::CODE); $key='scanner-server-'.$server->uuid;
    $record=$state->read($key); $record['updated']=$record['progressed']=time()-100; $state->write($key,$record);
    $scanner->info($server); same(2,count($queue)); $source->fail=true; foreach($source->files as &$content){$content.=' changed';}unset($content); $drain();
    $report=$scanner->info($server)['scan']; same(true,$report['partial']); same(3,$report['uninspected']);
    $scanner->start($server,42,false,false,ScanScope::CODE); $record=$state->read($key); $record['expires']=0; $state->write($key,$record);
    same('failed',$scanner->info($server)['scan']['status']);
});

test('scanner refuses synchronous queues and reports queue dispatch failure', function () use ($server,$owner,$app) {
    [$state,$source,$queue,$scanner,$drain] = scannerFixture(); $previous=config('queue.default');
    $app['config']->set('queue.default','sync'); reject(fn ()=>$scanner->start($server,42,false,false,ScanScope::CODE)); $app['config']->set('queue.default',$previous);
    $scanner=new BackdoorScanner($state,$source,new \Pterodactyl\Addons\GmodToolkit\Access($state),static function(){throw new RuntimeException('fixture');});
    reject(fn ()=>$scanner->start($server,42,false,false,ScanScope::CODE)); same('failed',$scanner->info($server)['scan']['status']);
});

test('native guarded manager jobs and the real database queue execute a complete scanner run', function () use ($server,$owner,$app,$panel) {
    [$state,$source,$unused,$old,$drain] = scannerFixture();
    $app['config']->set('queue.default','gmodqueue');
    try {
        $scanner=new BackdoorScanner($state,$source,new \Pterodactyl\Addons\GmodToolkit\Access($state));
        $app->instance(BackdoorScanner::class,$scanner);
        $manifest=json_decode(file_get_contents(dirname(__DIR__).'/addon/manifest.json'),true);
        file_put_contents($panel.'/storage/app/addon-manager/registry.json',json_encode(['addons'=>['gmod.toolkit'=>['version'=>$manifest['version'],'manifest'=>$manifest,'enabled'=>true]]]));
        $queue=$app['queue']->connection('gmodqueue'); $scanner->start($server,42,false,false,ScanScope::CODE); same(1,$queue->size('standard')); $steps=0;
        while($job=$queue->pop('standard')) {
            if(++$steps>100){throw new RuntimeException('Unbounded scanner queue');}
            $job->fire(); $job->delete();
        }
        $report=$scanner->info($server)['scan']; same('complete',$report['status']); same(3,$report['filesScanned']); same(0,$queue->size('standard'));
    } finally { $app['config']->set('queue.default','redis'); }
});

test('scanner source uses bounded existing Wings reads and rejects symlink ancestors or changed metadata', function () use ($server,$panel) {
    $dir=static fn($name)=>['name'=>$name,'mode'=>'drwxr-xr-x']; $raw='print("hello")';
    $row=['name'=>'a.lua','mode'=>'-rw-r--r--','size'=>strlen($raw),'modified'=>'fixed'];
    $response=static fn($rows)=>new \GuzzleHttp\Psr7\Response(200,[],json_encode($rows));
    $responses=[$response([$dir('garrysmod')]),$response([$dir('lua')]),$response([$row]),new \GuzzleHttp\Psr7\Response(200,[],$raw),$response([$dir('garrysmod')]),$response([$dir('lua')]),$response([$row])];
    $history=[]; $stack=\GuzzleHttp\HandlerStack::create(new \GuzzleHttp\Handler\MockHandler($responses)); $stack->push(\GuzzleHttp\Middleware::history($history));
    $client=new \GuzzleHttp\Client(['handler'=>$stack]);
    $repository=new class($client) extends \Pterodactyl\Repositories\Wings\DaemonFileRepository {
        public function __construct(private \GuzzleHttp\Client $client) {}
        public function getHttpClient(array $headers=[]): \GuzzleHttp\Client {return $this->client;}
    };
    $source=new ScannerSource($repository); $target=$panel.'/storage/app/scan-transport-'.bin2hex(random_bytes(6));
    $source->copy($server,'/garrysmod/lua/a.lua',['bytes'=>strlen($raw),'modified'=>'fixed'],$target);
    same($raw,file_get_contents($target)); unlink($target);
    foreach($history as $request){same('GET',$request['request']->getMethod());}
    $stack=\GuzzleHttp\HandlerStack::create(new \GuzzleHttp\Handler\MockHandler([$response([['name'=>'garrysmod','mode'=>'drwxr-xr-x','symlink'=>false,'is_symlink'=>true]])]));
    $reflection=new ReflectionProperty($repository,'client'); $reflection->setValue($repository,new \GuzzleHttp\Client(['handler'=>$stack]));
    reject(fn()=>$source->listing($server,'/garrysmod/lua'));
    reject(fn()=>$source->listing($server,'/'));
    reject(fn()=>$source->copy($server,'/backups/a.lua',['bytes'=>1,'modified'=>'fixed'],$target));
    foreach(['/../etc','/garrysmod/../secret','/garrysmod//lua',"/garrysmod/\0x",'/garrysmod/a\\b'] as $path){same(false,ScannerSource::path($path));}
});
