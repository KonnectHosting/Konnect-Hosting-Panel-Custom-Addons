#!/usr/bin/env php
<?php
declare(strict_types=1);

// Real Laravel container, disposable installed Panel and a recording dispatcher.
// No external queue, production data or addon handler is contacted/executed.
if (getenv('ADDON_MANAGER_ALLOW_DISPOSABLE_TESTS') !== '1') { exit(2); }
$panel = realpath($argv[1] ?? '');
if (!$panel || !is_file($panel . '/vendor/autoload.php')) { exit(2); }
define('LARAVEL_START', microtime(true));
require $panel . '/vendor/autoload.php';
require dirname(__DIR__) . '/bootstrap.php';
$app = require $panel . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
set_exception_handler(static function (\Throwable $error): void { fwrite(STDERR, (string) $error . "\n"); exit(1); });
$host = new \AddonManager\Laravel\HostAdapter($app);
$registry = $host->stateRoot . '/registry.json';
$before = is_file($registry) ? file_get_contents($registry) : null;
if (!is_dir(dirname($registry))) { mkdir(dirname($registry), 0700, true); }
$manifest = [
    'manifestVersion' => 1, 'id' => 'queue.example', 'name' => 'Queue Example', 'version' => '1.0.0',
    'compatibility' => ['manager' => '^2.0', 'panel' => '^1.15', 'php' => '^8.2'],
    'files' => [['source' => 'payload/Handler.php', 'target' => 'app/Addons/QueueExample/Handler.php', 'sha256' => hash('sha256', 'fixture')]],
    'extensions' => ['jobs' => [[
        'id' => 'work', 'handler' => 'Pterodactyl\\Addons\\QueueExample\\Handler@run', 'permission' => 'system',
    ]]],
];
$extensions = new \AddonManager\Laravel\ExtensionRegistry($app, $host);
$dispatcher = new class($app) extends \Illuminate\Bus\Dispatcher {
    public array $jobs = [];
    public function dispatch($command) { $this->jobs[] = $command; return 'queued'; }
};
$app->instance(\Illuminate\Contracts\Bus\Dispatcher::class, $dispatcher);
function queueCheck(bool $passed): void { if (!$passed) { throw new RuntimeException('Job dispatch regression failed.'); } }
function queueReject(callable $operation): void {
    try { $operation(); } catch (\Throwable) { return; }
    throw new RuntimeException('Invalid job dispatch was accepted.');
}
try {
    file_put_contents($registry, json_encode(['addons' => ['queue.example' => ['version' => '1.0.0', 'enabled' => true, 'manifest' => $manifest]]]));
    queueCheck(!$app->bound('bus'));
    queueCheck($extensions->dispatchJob('queue.example', '1.0.0', 'work', ['serverId' => 123]) === 'queued');
    queueCheck(count($dispatcher->jobs) === 1);
    $job = $dispatcher->jobs[0];
    queueCheck($job instanceof \AddonManager\Laravel\AddonJob);
    queueCheck($job->addonId === 'queue.example' && $job->addonVersion === '1.0.0' && $job->jobId === 'work' && $job->payload === ['serverId' => 123]);
    queueReject(fn () => $extensions->dispatchJob('queue.example', '2.0.0', 'work'));
    queueReject(fn () => $extensions->dispatchJob('queue.example', '1.0.0', 'unknown'));
    queueReject(fn () => $extensions->dispatchJob('queue.example', '1.0.0', 'work', ['object' => new stdClass()]));
    file_put_contents($registry, json_encode(['addons' => []]));
    queueReject(fn () => $extensions->dispatchJob('queue.example', '1.0.0', 'work'));
    queueCheck(count($dispatcher->jobs) === 1);
    echo "PASS real Laravel dispatcher contract, guarded native wrapper, disabled/version/registration/payload rejection\n";
} finally {
    if ($before !== null) { file_put_contents($registry, $before); } else { unlink($registry); }
}
