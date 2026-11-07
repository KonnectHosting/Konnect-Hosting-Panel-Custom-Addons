<?php
declare(strict_types=1);

use Pterodactyl\Addons\GmodToolkit\{StartGuard,ScanScope};

test('targeted scan excludes a synthetic 120 GiB asset/container tree and retains material/script coverage', function () use ($server) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();
    foreach(['/fastdl/maps/huge.bsp','/backups/all.tar','/bin/runtime.lua','/garrysmod/addons/example/models/huge.mdl','/garrysmod/addons/example/maps/huge.bsp','/steam_cache/garrysmod/lua/not_selected.lua'] as $path){$source->files[$path]='';$source->sizes[$path]=20*1024*1024*1024;}
    $source->links['/garrysmod/addons/example/models']=true;
    $source->files['/garrysmod/materials/payload.vmt']='RunString(file.Read("hidden.txt"))';
    $scanner->start($server,42);$drain();$report=$scanner->info($server)['scan'];
    same('complete',$report['status']);same(4,$report['filesScanned']);same(false,$report['partial']);
    foreach($source->listed as $path){same(true,ScanScope::directory($path,false));}
    same(false,in_array('/',$source->listed,true)); same(false,in_array('/garrysmod/addons/example/models',$source->listed,true));
    same(true,in_array('/garrysmod/materials/payload.vmt',$source->copied,true));
    same(false,ScanScope::directory('/steam_cache/garrysmod',true));same(true,ScanScope::directory('/steam_cache/content/4000/123',true));
});

test('incremental results reuse unchanged files, scan new/deleted/modified code and support forced content verification', function () use ($server) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();$source->files=['/garrysmod/lua/a.lua'=>str_pad('print(1)',64)];
    $scanner->start($server,42);$drain();same(1,$source->copies);
    $scanner->start($server,42);$drain();$report=$scanner->info($server)['scan'];same(1,$report['reused']);same(0,$report['bytes']);same(1,$source->copies);
    $source->files['/garrysmod/lua/new.lua']='RunString(net.ReadString())';
    $scanner->start($server,42);$drain();$report=$scanner->info($server)['scan'];same(1,$report['reused']);same(2,$source->copies);same(true,$report['unapprovedHigh']>0);
    unset($source->files['/garrysmod/lua/new.lua']);$source->files['/garrysmod/lua/a.lua']=str_pad('RunString(net.ReadString())',64);
    $scanner->start($server,42,false,true);$drain();$report=$scanner->info($server)['scan'];same(1,$report['filesScanned']);same(0,$report['reused']);same(true,$report['unapprovedHigh']>0);
    same(['/garrysmod/lua/a.lua'],array_values(array_unique(array_column($report['findings'],'file'))));
});

test('text results arrive before later discovery or optional archive budgets and old unrestricted jobs cannot resume', function () use ($server,$owner) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();$source->files['/garrysmod/addons/packed.gma']='large';$source->sizes['/garrysmod/addons/packed.gma']=1024*1024*1024;
    $scanner->start($server,42,true);$key='scanner-server-'.$server->uuid;$seen=false;
    for($i=0;$i<100&&count($queue);++$i){$payload=$queue[0];$queue->offsetUnset(0);$queue->exchangeArray(array_values($queue->getArrayCopy()));$scanner->step($server,$owner,$payload);$job=$state->read($key);if($job['filesScanned']>0&&($job['rootsPending']||$job['dirs'])){$seen=true;}if(!$job['rootsPending']&&!$job['dirs']&&!$job['entries']){break;}}
    same(true,$seen);$job=$state->read($key);$job['archiveBudgetUsed']=\Pterodactyl\Addons\GmodToolkit\BackdoorScanner::ARCHIVE_BUDGET;$state->write($key,$job);$drain();
    $report=$scanner->info($server)['scan'];same('complete',$report['status']);same(3,$report['filesScanned']);same(true,$report['partial']);same(false,in_array('/garrysmod/addons/packed.gma',$source->copied,true));
    $scanner->start($server,42);$job=$state->read($key);unset($job['scopeVersion']);$job['dirs']=['/'];$state->write($key,$job);
    same('failed',$scanner->info($server)['scan']['status']);$drain();same(false,in_array('/',$source->listed,true));
});

function powerFixture(): array {
    [$state,$source,$scanQueue,$scanner,$scanDrain]=scannerFixture();$powerQueue=new ArrayObject();$sent=new ArrayObject();
    $guard=new StartGuard($state,$scanner,new \Pterodactyl\Addons\GmodToolkit\Access($state),static function($payload,$delay)use($powerQueue){$powerQueue[]=$payload;},static function($server,$signal)use($sent){$sent[]=[$server->uuid,$signal];});
    $drain=static function()use($powerQueue,$guard,$scanDrain){$steps=0;while(count($powerQueue)){if(++$steps>50){throw new RuntimeException('Power-check queue did not finish.');}$p=$powerQueue[0];$powerQueue->offsetUnset(0);$powerQueue->exchangeArray(array_values($powerQueue->getArrayCopy()));$guard->handle($p);$scanDrain();}};
    return [$state,$source,$scanner,$guard,$powerQueue,$sent,$drain];
}

test('guarded start checks clean code first, reuses analysis and never forwards a duplicate or cancelled action', function () use ($server,$owner) {
    [$state,$source,$scanner,$guard,$queue,$sent,$drain]=powerFixture();$source->files=['/garrysmod/lua/a.lua'=>'print(1)'];
    $guard->request($server,$owner,'start');same(0,count($sent));$guard->request($server,$owner,'start');same(1,count($queue));$payload=$queue[0];$drain();same([[$server->uuid,'start']],$sent->getArrayCopy());
    $guard->handle($payload);same(1,count($sent));
    $guard->request($server,$owner,'restart');$drain();same(2,count($sent));same(1,$scanner->info($server)['scan']['reused']);
    $guard->request($server,$owner,'start');$guard->cancelRequest($server,$owner);$drain();same(2,count($sent));same('cancelled',$state->read('scanner-power-'.$server->uuid)['status']);
});

test('new high-risk code blocks start, exact-hash approval is permission checked and changed bytes revoke it', function () use ($server,$owner,$reader) {
    [$state,$source,$scanner,$guard,$queue,$sent,$drain]=powerFixture();$source->files=['/garrysmod/lua/a.lua'=>str_pad('RunString(net.ReadString())',100)];
    $guard->request($server,$owner,'start');$drain();same(0,count($sent));same('blocked',$state->read('scanner-power-'.$server->uuid)['status']);
    $report=$scanner->info($server)['scan'];$finding=$report['findings'][0];
    reject(fn()=>$scanner->approve($server,$reader->id,$report['id'],$finding['file'],$finding['fingerprint']),403);
    reject(fn()=>$scanner->approve($server,42,$report['id'],$finding['file'],str_repeat('0',64)),409);
    $scanner->approve($server,42,$report['id'],$finding['file'],$finding['fingerprint']);$guard->request($server,$owner,'start');$drain();same(1,count($sent));
    $source->files['/garrysmod/lua/a.lua']=str_pad('RunString(net.ReadData(10))',100); // same size and preserved timestamp
    $guard->request($server,$owner,'restart');$drain();same(1,count($sent));same('blocked',$state->read('scanner-power-'.$server->uuid)['status']);
});

test('pre-start guard fails closed on scan errors, queue failures, missing actors, stale requests and revoked permissions', function () use ($server,$owner,$reader,$db) {
    [$state,$source,$scanner,$guard,$queue,$sent,$drain]=powerFixture();$source->fail=true;
    reject(fn()=>$guard->request($server,$reader,'start'),403);
    $guard->request($server,$owner,'start');$drain();same(0,count($sent));same('blocked',$state->read('scanner-power-'.$server->uuid)['status']);
    $source->fail=false;$guard->request($server,$owner,'start');
    $db->statement('CREATE TABLE IF NOT EXISTS subusers (id INTEGER PRIMARY KEY, server_id INTEGER, user_id INTEGER, permissions TEXT)');
    $db->table('servers')->where('id',1)->update(['owner_id'=>999]);
    try{$drain();same(0,count($sent));}finally{$db->table('servers')->where('id',1)->update(['owner_id'=>42]);}
    $source->fail=false;$guard->request($server,$owner,'start');$key='scanner-power-'.$server->uuid;$r=$state->read($key);$r['expires']=0;$state->write($key,$r);$drain();same(0,count($sent));
    $guard->request($server,$owner,'start');$r=$state->read($key);$r['actor']=99999;$state->write($key,$r);$drain();same(0,count($sent));
    $broken=new StartGuard($state,$scanner,new \Pterodactyl\Addons\GmodToolkit\Access($state),static function(){throw new RuntimeException('queue fixture');});
    reject(fn()=>$broken->request($server,$owner,'start'));same('blocked',$state->read($key)['status']);
});

test('the actual shared power repository holds Panel starts and lets stop cancel pending work', function () use ($server,$owner,$app,$panel) {
    [$state,$source,$scanner,$guard,$queue,$sent,$drain]=powerFixture();$source->files=['/garrysmod/lua/a.lua'=>'print(1)'];
    $app->instance(StartGuard::class,$guard);$manifest=json_decode(file_get_contents(dirname(__DIR__).'/addon/manifest.json'),true);
    file_put_contents($panel.'/storage/app/addon-manager/registry.json',json_encode(['addons'=>['gmod.toolkit'=>['version'=>$manifest['version'],'manifest'=>$manifest,'enabled'=>true]]]));
    $history=[];$stack=\GuzzleHttp\HandlerStack::create(new \GuzzleHttp\Handler\MockHandler([new \GuzzleHttp\Psr7\Response(204),new \GuzzleHttp\Psr7\Response(204)]));$stack->push(\GuzzleHttp\Middleware::history($history));
    $client=new \GuzzleHttp\Client(['handler'=>$stack]);
    $repository=new class($client) extends \Pterodactyl\Repositories\Wings\DaemonPowerRepository {
        public function __construct(private \GuzzleHttp\Client $client){} public function getHttpClient(array $headers=[]): \GuzzleHttp\Client{return $this->client;}
    };
    $send=new ReflectionProperty($guard,'send');$send->setValue($guard,static fn($target,$signal)=>$repository->setServer($target)->send($signal));
    same(202,$repository->setServer($server)->send('start')->getStatusCode());same(0,count($history));same(1,count($queue));
    $drain();same(1,count($history));same('sent',$state->read('scanner-power-'.$server->uuid)['status']);
    same(202,$repository->setServer($server)->send('start')->getStatusCode());
    same(204,$repository->setServer($server)->send('stop')->getStatusCode());same(2,count($history));$drain();same(2,count($history));
    file_put_contents($panel.'/storage/app/addon-manager/registry.json',json_encode(['addons'=>[]]));
});

test('fresh GMod websocket permissions deny direct power bypass without expanding subuser permissions',function()use($server,$app,$panel){
    [$state,$source,$scanner,$guard,$queue,$sent,$drain]=powerFixture();$app->instance(StartGuard::class,$guard);
    $manifest=json_decode(file_get_contents(dirname(__DIR__).'/addon/manifest.json'),true);
    file_put_contents($panel.'/storage/app/addon-manager/registry.json',json_encode(['addons'=>['gmod.toolkit'=>['version'=>$manifest['version'],'manifest'=>$manifest,'enabled'=>true]]]));
    $permissions=StartGuard::websocketPermissions($server,['*','admin.websocket.errors']);
    foreach(['*','control.start','control.restart','control.stop']as$denied){same(false,in_array($denied,$permissions,true));}
    foreach(['websocket.connect','control.console','admin.websocket.errors','gmod.toolkit.guarded-power']as$kept){same(true,in_array($kept,$permissions,true));}
    same(false,in_array('admin.websocket.install',$permissions,true));
    same(['websocket.connect','gmod.toolkit.guarded-power'],StartGuard::websocketPermissions($server,['websocket.connect','control.start']));
    $other=clone $server;$other->egg_id=999;same(['*'],StartGuard::websocketPermissions($other,['*']));
    file_put_contents($panel.'/storage/app/addon-manager/registry.json',json_encode(['addons'=>[]]));
    same(['*'],StartGuard::websocketPermissions($server,['*']));
});

test('read-only collaborators cannot approve code or cancel another user preflight scan',function()use($server,$owner,$reader){
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();$scanner->start($server,42);
    reject(fn()=>$scanner->cancel($server,$reader),403);$drain();
    $report=$scanner->info($server)['scan'];$f=$report['findings'][0];
    reject(fn()=>$scanner->approve($server,$reader->id,$report['id'],$f['file'],$f['fingerprint']),403);
});

test('native guarded queue serialization completes an automatic pre-start scan before sending power',function()use($server,$owner,$app,$panel,$db){
    [$state,$source,$unused,$old,$scanDrain]=scannerFixture();$source->files=['/garrysmod/lua/a.lua'=>'print(1)'];$sent=new ArrayObject();
    $scanner=new \Pterodactyl\Addons\GmodToolkit\BackdoorScanner($state,$source,new \Pterodactyl\Addons\GmodToolkit\Access($state));
    $guard=new StartGuard($state,$scanner,new \Pterodactyl\Addons\GmodToolkit\Access($state),null,static function($s,$signal)use($sent){$sent[]=$signal;});
    $app->instance(\Pterodactyl\Addons\GmodToolkit\BackdoorScanner::class,$scanner);$app->instance(StartGuard::class,$guard);
    $manifest=json_decode(file_get_contents(dirname(__DIR__).'/addon/manifest.json'),true);
    file_put_contents($panel.'/storage/app/addon-manager/registry.json',json_encode(['addons'=>['gmod.toolkit'=>['version'=>$manifest['version'],'manifest'=>$manifest,'enabled'=>true]]]));
    $app['config']->set('queue.default','gmodqueue');
    try{
        $queue=$app['queue']->connection('gmodqueue');$guard->request($server,$owner,'start');same(0,count($sent));$steps=0;
        while($queue->size('standard')){
            if(++$steps>100){throw new RuntimeException('Unbounded native pre-start queue.');}
            $db->table('jobs')->update(['available_at'=>time()]); // advance delayed jobs inside this disposable fixture
            $job=$queue->pop('standard');if(!$job){throw new RuntimeException('Native queue could not pop ready fixture work.');}$job->fire();$job->delete();
        }
        same(['start'],$sent->getArrayCopy());same('sent',$state->read('scanner-power-'.$server->uuid)['status']);same('complete',$scanner->info($server)['scan']['status']);
    }finally{$app['config']->set('queue.default','redis');}
});
