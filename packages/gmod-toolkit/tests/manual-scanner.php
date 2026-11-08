<?php
declare(strict_types=1);

use Pterodactyl\Addons\GmodToolkit\{ScanScope};

test('targeted scan excludes a synthetic 120 GiB asset/container tree and retains material/script coverage', function () use ($server) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();
    foreach(['/fastdl/maps/huge.bsp','/backups/all.tar','/bin/runtime.lua','/garrysmod/addons/example/models/huge.mdl','/garrysmod/addons/example/maps/huge.bsp','/steam_cache/garrysmod/lua/not_selected.lua'] as $path){$source->files[$path]='';$source->sizes[$path]=20*1024*1024*1024;}
    $source->links['/garrysmod/addons/example/models']=true;
    $source->files['/garrysmod/materials/payload.vmt']='RunString(file.Read("hidden.txt"))';
    $scanner->start($server,42,false,false,ScanScope::CODE);$drain();$report=$scanner->info($server)['scan'];
    same('complete',$report['status']);same(4,$report['filesScanned']);same(false,$report['partial']);
    foreach($source->listed as $path){same(true,ScanScope::directory($path,false));}
    same(false,in_array('/',$source->listed,true)); same(false,in_array('/garrysmod/addons/example/models',$source->listed,true));
    same(true,in_array('/garrysmod/materials/payload.vmt',$source->copied,true));
    same(false,ScanScope::directory('/steam_cache/garrysmod',true));same(true,ScanScope::directory('/steam_cache/content/4000/123',true));
});

test('incremental results reuse unchanged files, scan new/deleted/modified code and support forced content verification', function () use ($server) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();$source->files=['/garrysmod/lua/a.lua'=>str_pad('print(1)',64)];
    $scanner->start($server,42,false,false,ScanScope::CODE);$drain();same(1,$source->copies);
    $scanner->start($server,42,false,false,ScanScope::CODE);$drain();$report=$scanner->info($server)['scan'];same(1,$report['reused']);same(0,$report['bytes']);same(1,$source->copies);
    $source->files['/garrysmod/lua/new.lua']='RunString(net.ReadString())';
    $scanner->start($server,42,false,false,ScanScope::CODE);$drain();$report=$scanner->info($server)['scan'];same(1,$report['reused']);same(2,$source->copies);same(true,count(array_filter($report['findings'],static fn($f)=>in_array($f['severity'],['high','critical'],true)))>0);
    unset($source->files['/garrysmod/lua/new.lua']);$source->files['/garrysmod/lua/a.lua']=str_pad('RunString(net.ReadString())',64);
    $scanner->start($server,42,false,true,ScanScope::CODE);$drain();$report=$scanner->info($server)['scan'];same(1,$report['filesScanned']);same(0,$report['reused']);same(true,count(array_filter($report['findings'],static fn($f)=>in_array($f['severity'],['high','critical'],true)))>0);
    same(['/garrysmod/lua/a.lua'],array_values(array_unique(array_column($report['findings'],'file'))));
});

test('text results arrive before later discovery or optional archive budgets and old unrestricted jobs cannot resume', function () use ($server,$owner) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();$source->files['/garrysmod/addons/packed.gma']='large';$source->sizes['/garrysmod/addons/packed.gma']=1024*1024*1024;
    $scanner->start($server,42,true,false,ScanScope::roots(true));$key='scanner-server-'.$server->uuid;$seen=false;
    for($i=0;$i<100&&count($queue);++$i){$payload=$queue[0];$queue->offsetUnset(0);$queue->exchangeArray(array_values($queue->getArrayCopy()));$scanner->step($server,$owner,$payload);$job=$state->read($key);if($job['filesScanned']>0&&($job['rootsPending']||$job['dirs'])){$seen=true;}if(!$job['rootsPending']&&!$job['dirs']&&!$job['entries']){break;}}
    same(true,$seen);$job=$state->read($key);$job['archiveBudgetUsed']=\Pterodactyl\Addons\GmodToolkit\BackdoorScanner::ARCHIVE_BUDGET;$state->write($key,$job);$drain();
    $report=$scanner->info($server)['scan'];same('complete',$report['status']);same(3,$report['filesScanned']);same(true,$report['partial']);same(false,in_array('/garrysmod/addons/packed.gma',$source->copied,true));
    $scanner->start($server,42,false,false,ScanScope::CODE);$job=$state->read($key);unset($job['scopeVersion']);$job['dirs']=['/'];$state->write($key,$job);
    same('cancelled',$scanner->info($server)['scan']['status']);$drain();same(false,in_array('/',$source->listed,true));
});


test('manual selection defaults to addons, supports one folder/file and never searches unrelated locations', function () use ($server) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();
    same(null,$scanner->info($server)['scan']);same(0,count($queue));
    $scanner->start($server,42);$drain();same(1,$scanner->info($server)['scan']['filesScanned']);
    same(['/garrysmod/addons'],$scanner->info($server)['scan']['locations']);
    $source->listed=[];$source->copied=[];
    $scanner->start($server,42,false,true,['/garrysmod/lua/safe.lua']);$drain();
    same(['/garrysmod/lua/safe.lua'],$source->copied);same(1,$scanner->info($server)['scan']['filesScanned']);
    $scanner->start($server,42,false,false,['/garrysmod/addons/example/lua']);$drain();same(1,$scanner->info($server)['scan']['filesScanned']);
    foreach([[],['/'],['/fastdl'],['/backups/all.lua'],['/garrysmod/addons/example/models'],['/garrysmod/lua/../secret'],['/steam_cache']] as $locations){reject(fn()=>$scanner->start($server,42,false,false,$locations));}
    same(['/garrysmod/addons'],ScanScope::selection(['/garrysmod/addons/example','/garrysmod/addons','/garrysmod/addons'],false));
});

test('cancel is immediate while worker lock is held and never deletes the active input or requeues cancelled work', function () use ($server,$owner,$reader) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();$scanner->start($server,42);$key='scanner-server-'.$server->uuid;
    $job=$state->read($key);$path=$state->object($job['snapshot'],hash('sha256','input'));file_put_contents($path,'active input');
    reject(fn()=>$scanner->cancel($server,$reader),403);
    $state->locked($key,function()use($scanner,$server,$owner,$path){
        same('cancelled',$scanner->cancel($server,$owner)['status']);same(true,is_file($path));
        same('cancelling',$scanner->info($server)['scan']['status']);
    });
    $drain();same('cancelled',$scanner->info($server)['scan']['status']);same(false,is_file($path));same(0,$source->copies);same(0,count($queue));
    $scanner->info($server);same(0,count($queue));
    $scanner->start($server,42);$drain();same('complete',$scanner->info($server)['scan']['status']);
});

test('disabling manual scanner cancels active work, requires file permissions and enabling never starts scans', function () use ($server,$owner,$reader) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();
    $controller=new \Pterodactyl\Addons\GmodToolkit\ScannerController(new \Pterodactyl\Addons\GmodToolkit\Access($state),$scanner);
    reject(fn()=>$controller->settings(requestFor($reader,['enabled'=>false]),$server),403);
    $scanner->start($server,42);$scanner->settings($server,false);$drain();
    same(false,$scanner->info($server)['enabled']);same('cancelled',$scanner->info($server)['scan']['status']);same(0,$source->copies);
    reject(fn()=>$scanner->start($server,42),409);$scanner->settings($server,true);$scanner->info($server);same(0,count($queue));
});

test('legacy automatic jobs and obsolete findings are retired without scanning or requesting power', function () use ($server) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();$scanner->start($server,42);$key='scanner-server-'.$server->uuid;$job=$state->read($key);
    unset($job['manual']);$job['rulesVersion']='2026.11.07.2';$job['scopeVersion']='targeted-v1';$job['findings']=[['rule'=>'remote-handler-execution','severity'=>'high']];$state->write($key,$job);
    $info=$scanner->info($server)['scan'];same('cancelled',$info['status']);same(true,$info['outdated']);same([],$info['findings']);$drain();same(0,$source->copies);same(0,count($queue));
    $scanner->info($server);same(0,count($queue));
});

test('native power requests go straight to Wings regardless of scanner state', function () use ($server) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();$scanner->start($server,42);$history=[];
    $stack=\GuzzleHttp\HandlerStack::create(new \GuzzleHttp\Handler\MockHandler(array_fill(0,4,new \GuzzleHttp\Psr7\Response(204))));$stack->push(\GuzzleHttp\Middleware::history($history));
    $repository=new class(new \GuzzleHttp\Client(['handler'=>$stack])) extends \Pterodactyl\Repositories\Wings\DaemonPowerRepository {
        public function __construct(private \GuzzleHttp\Client $client){}public function getHttpClient(array $headers=[]): \GuzzleHttp\Client{return $this->client;}
    };
    foreach(['start','restart','stop','kill'] as $signal){same(204,$repository->setServer($server)->send($signal)->getStatusCode());}
    same(4,count($history));same(1,count($queue));same(0,$source->copies);
    same(false,class_exists('Pterodactyl\\Addons\\GmodToolkit\\StartGuard'));
});


test('cancellation during a live read retains the partial report and stops the job chain', function () use ($server,$owner) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();
    $source->onCopy=fn()=>$scanner->cancel($server,$owner);
    $scanner->start($server,42);$drain();
    same('cancelled',$scanner->info($server)['scan']['status']);same(1,$source->copies);same(0,count($queue));
});

test('manual scanner API requires a nonempty validated selection', function () use ($server,$owner) {
    [$state,$source,$queue,$scanner,$drain]=scannerFixture();
    $controller=new \Pterodactyl\Addons\GmodToolkit\ScannerController(new \Pterodactyl\Addons\GmodToolkit\Access($state),$scanner);
    reject(fn()=>$controller->start(requestFor($owner,[]),$server));
    reject(fn()=>$controller->start(requestFor($owner,['locations'=>[]]),$server));same(0,count($queue));
    same(422,$controller->start(requestFor($owner,['locations'=>['/']]),$server)->getStatusCode());
    same(200,$controller->start(requestFor($owner,['locations'=>['/garrysmod/lua/safe.lua']]),$server)->getStatusCode());
    $drain();same(1,$scanner->info($server)['scan']['filesScanned']);
    same(['/steam_cache/123.bin'],ScanScope::selection(['/steam_cache/123.bin'],true));
});
