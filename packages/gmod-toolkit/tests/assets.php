<?php
declare(strict_types=1);

use Pterodactyl\Addons\GmodToolkit\{Workshop,AddonPackage,Access,ToolkitController};

function gmaRead(string $bytes): array {
    same('GMAD' . chr(3), substr($bytes, 0, 5)); $offset = 21;
    $string = static function () use ($bytes, &$offset): string {
        $end = strpos($bytes, "\0", $offset); if ($end === false) { throw new RuntimeException('Unterminated GMA string'); }
        $value = substr($bytes, $offset, $end - $offset); $offset = $end + 1; return $value;
    };
    same('', $string()); $title = $string(); $metadata = json_decode($string(), true, 32, JSON_THROW_ON_ERROR); $string();
    same(1, unpack('V', substr($bytes, $offset, 4))[1]); $offset += 4;
    $entries = [];
    while ($number = unpack('V', substr($bytes, $offset, 4))[1]) {
        $offset += 4; $path = $string(); $size = unpack('P', substr($bytes, $offset, 8))[1]; $offset += 8;
        $crc = unpack('V', substr($bytes, $offset, 4))[1]; $offset += 4;
        same(count($entries) + 1, $number); $entries[] = compact('path', 'size', 'crc');
    }
    $offset += 4; $files = [];
    foreach ($entries as $entry) {
        $content = substr($bytes, $offset, $entry['size']); $offset += $entry['size'];
        same($entry['crc'], crc32($content)); $files[$entry['path']] = $content;
    }
    same(strlen($bytes) - 4, $offset);
    same(crc32(substr($bytes, 0, -4)), unpack('V', substr($bytes, -4))[1]);
    return compact('title', 'metadata', 'files');
}

test('Workshop cards expose trusted artwork and bounded metadata without HTML or hostile image URLs', function () use (&$fixture, $workshop) {
    $fixture['101']['metadata'] = ['preview_url' => 'http://images.steamusercontent.com/ugc/example/image.jpg', 'file_size' => '1234',
        'description' => '[b]Client assets[/b] <script>unsafe()</script>', 'time_updated' => 1700000000, 'subscriptions' => 23456];
    $result = $workshop->resolve('100'); $item = $result['items'][0];
    same('https://images.steamusercontent.com/ugc/example/image.jpg', $item['image']);
    same(1234, $item['bytes']); same(23456, $item['subscribers']); same(1700000000, $item['updated']);
    same(false, str_contains($item['description'], '<script>')); same(false, str_contains($item['description'], '[b]'));
    same(1234, $result['bytes']); same(1, $result['knownSizes']);
    foreach (['javascript:alert(1)', 'https://steamcommunity.com.evil.test/a.jpg', 'https://user@images.steamusercontent.com/a.jpg', 'http://127.0.0.1/a.jpg', 'https://images.steamusercontent.com:444/a.jpg'] as $url) { same(null, Workshop::image($url)); }
    same('https://images.akamai.steamusercontent.com/image.jpg', Workshop::image('https://images.akamai.steamusercontent.com/image.jpg'));
    same(null, Workshop::image('https://steamusercontent.com.evil.test/image.jpg'));
    unset($fixture['101']['metadata']);
});

test('applied collections keep their card metadata after refresh and backup restoration clears stale cards', function () use ($controller, $server, $owner, $files, $state) {
    $files->current = 'resource.AddWorkshop("101")';
    $preview = $controller->preview(requestFor($owner, ['collection' => '100']), $server)->getData(true);
    $controller->apply(requestFor($owner, ['preview' => $preview['preview']]), $server);
    $status = $controller->workshopStatus(requestFor($owner), $server)->getData(true);
    same('100', $status['collection']['collection']); same(['101','102'], array_column($status['collection']['items'], 'id'));
    $backup = $state->backups($server->uuid)[0]['id'];
    $restore = $controller->preview(requestFor($owner, ['backup' => $backup]), $server)->getData(true);
    $controller->apply(requestFor($owner, ['preview' => $restore['preview']]), $server);
    same(null, $controller->workshopStatus(requestFor($owner), $server)->getData(true)['collection']);
});

test('Workshop export builds an actual CRC-verified GMA v3 and valid ZIP with chosen metadata and cover', function () use ($server, $owner, $workshop) {
    [$state,$source,$queue,$engine,$drain] = fastdlFixture(); $preview = readyPreview($engine, $drain);
    $engine->buildAddon($server, 42, $preview['preview'], ['name' => 'Ember content ✓', 'description' => 'My client resources']);
    $drain(); $info = $engine->info($server, 42);
    same('addon-ready', $info['job']['status']); same(null, $info['url']);
    $artifact = $engine->addonDownload($server, 42, $info['addon']['id']);
    $controller = new ToolkitController(new Access($state), $state, new MemoryWings(), $workshop, $engine);
    $response = $controller->downloadAddon(requestFor($owner), $server, $info['addon']['id']);
    same(200, $response->getStatusCode()); same('application/zip', $response->headers->get('Content-Type'));
    same(true, str_contains($response->headers->get('Cache-Control'), 'no-store'));
    same(true, str_contains($response->headers->get('Cache-Control'), 'private'));
    $zip = new ZipArchive(); same(true, $zip->open($artifact['path'], ZipArchive::CHECKCONS));
    same(5, $zip->numFiles);
    $addon = gmaRead($zip->getFromName('addon.gma'));
    same('Ember content ✓', $addon['title']); same('My client resources', $addon['metadata']['description']); same('servercontent', $addon['metadata']['type']);
    same([], $addon['metadata']['tags']);
    same(['maps/test.bsp' => 'VBSP map', 'materials/test.vmt' => 'LightmappedGeneric {}'], $addon['files']);
    $cover = getimagesizefromstring($zip->getFromName('preview.jpg')); same(512, $cover[0]); same(512, $cover[1]); same('image/jpeg', $cover['mime']);
    same('My client resources', $zip->getFromName('description.txt'));
    same(true, str_contains($zip->getFromName('PUBLISHING.txt'), 'gmpublish.exe create'));
    same(false, str_contains($zip->getFromName('PUBLISHING.txt'), 'rcon_password')); $zip->close();
    same(null, $engine->info($server, 43)['addon']);
});

test('Workshop export normalizes case and rejects collisions and files disallowed by the GMod publisher', function () use ($server) {
    [$state,$source,$queue,$engine,$drain] = fastdlFixture(); $source->files = ['models/Thing.MDL' => 'model'];
    $preview = readyPreview($engine, $drain); $engine->buildAddon($server,42,$preview['preview'],['name'=>'Test', 'description'=>'']); $drain();
    $artifact = $engine->addonDownload($server,42,$engine->info($server,42)['addon']['id']);
    $zip = new ZipArchive(); same(true,$zip->open($artifact['path'])); same(['models/thing.mdl'=>'model'], gmaRead($zip->getFromName('addon.gma'))['files']); $zip->close();
    foreach ([['models/A.mdl'=>'a','models/a.mdl'=>'b'], ['resource/fonts/a.otf'=>'font'], ['models/a.sw.vtx'=>'unused'], ['materials/a.vmt'=>'']] as $files) {
        $source->files = $files; $preview = readyPreview($engine,$drain);
        reject(fn () => $engine->buildAddon($server,42,$preview['preview'],['name'=>'Test','description'=>'']));
    }
});

test('export authorization, actor binding, invalid covers and stale previews cannot yield a private archive', function () use ($server, $controller, $reader, $owner, $db) {
    reject(fn () => $controller->buildAddon(requestFor($reader, ['preview'=>str_repeat('a',64),'name'=>'x','description'=>'']), $server),403);
    reject(fn () => $controller->downloadAddon(requestFor($reader), $server,str_repeat('a',64)),403);
    reject(fn () => $controller->cover(requestFor(null),$server),403);
    same('running', $controller->buildAddon(requestFor($owner, ['preview'=>str_repeat('a',64),'name'=>'Valid title','description'=>null]), $server)->getData(true)['status']);
    [$state,$source,$queue,$engine,$drain] = fastdlFixture(); $preview=readyPreview($engine,$drain);
    foreach ([['name'=>'','description'=>''], ['name'=>"bad\0name",'description'=>''], ['name'=>'name','description'=>'','cover'=>base64_encode('not JPEG')]] as $input) { reject(fn () => $engine->buildAddon($server,42,$preview['preview'],$input)); }
    reject(fn () => $engine->buildAddon($server,43,$preview['preview'],['name'=>'name','description'=>'']),409);
    $engine->buildAddon($server,42,$preview['preview'],['name'=>'name','description'=>'']);$drain();$id=$engine->info($server,42)['addon']['id'];
    $db->table('users')->insertOrIgnore(['id'=>45,'root_admin'=>1,'use_totp'=>0]);
    reject(fn () => $engine->addonDownload($server,45,$id),404);
    $other=clone $server;$other->uuid='87654321-1234-1234-1234-123456789abc';reject(fn () => $engine->addonDownload($other,42,$id),404);
    $key='fastdl-server-'.$server->uuid;$record=$state->read($key);$record['job']['expires']=0;$state->write($key,$record);
    reject(fn () => $engine->addonDownload($server,42,$id),404);
});

test('interrupted package appends replay without duplicated bytes or invalid ZIP/GMA checksums', function () use ($server, $owner) {
    [$state,$source,$queue,$engine,$drain] = fastdlFixture();$preview=readyPreview($engine,$drain);
    $engine->buildAddon($server,42,$preview['preview'],['name'=>'Replay test','description'=>'']);
    $key='fastdl-server-'.$server->uuid;
    while ($state->read($key)['job']['phase'] !== 'addon-write') {
        $payload=$queue[0];$queue->offsetUnset(0);$queue->exchangeArray(array_values($queue->getArrayCopy()));$engine->step($server,$owner,$payload);
    }
    $before=$state->read($key);$engine->step($server,$owner,$queue[0]);
    $before['job']['updated']=time()-120;$state->write($key,$before);$queue->exchangeArray([]);$engine->info($server,42);$drain();
    $artifact=$engine->addonDownload($server,42,$engine->info($server,42)['addon']['id']);$zip=new ZipArchive();same(true,$zip->open($artifact['path'],ZipArchive::CHECKCONS));
    same(['maps/test.bsp'=>'VBSP map','materials/test.vmt'=>'LightmappedGeneric {}'],gmaRead($zip->getFromName('addon.gma'))['files']);$zip->close();
});

test('failed or replaced exports preserve FastDL publications and revoke obsolete private downloads', function () use ($server) {
    [$state,$source,$queue,$engine,$drain]=fastdlFixture();$token=published($engine,$drain);$preview=readyPreview($engine,$drain);
    $r=$state->read('fastdl-server-'.$server->uuid);file_put_contents($state->object($r['job']['snapshot'],hash('sha256','maps/test.bsp')),'tampered');
    $engine->buildAddon($server,42,$preview['preview'],['name'=>'Test','description'=>'']);$drain();same('failed',$engine->info($server,42)['job']['status']);
    same('VBSP map',file_get_contents($engine->download($token,'maps/test.bsp')['path']));
    $preview=readyPreview($engine,$drain);$engine->buildAddon($server,42,$preview['preview'],['name'=>'Test','description'=>'']);$drain();$id=$engine->info($server,42)['addon']['id'];
    foreach (['maps/addon.gma','maps/workshop.zip',AddonPackage::key('workshop.zip')] as $path) reject(fn () => $engine->download($token,$path),404);
    $engine->preview($server,42);reject(fn () => $engine->addonDownload($server,42,$id),404);
});
