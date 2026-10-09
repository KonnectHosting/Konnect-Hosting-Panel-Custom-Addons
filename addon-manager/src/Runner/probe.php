<?php

declare(strict_types=1);

// Executed only inside the restricted validation container.
$complete = false;
register_shutdown_function(static function () use (&$complete): void {
    if (!$complete) {
        fwrite(STDERR, "The isolated probe ended before completing validation.\n");
        exit(1);
    }
});
try {
    $job = json_decode((string) file_get_contents('/job/input.json'), true, 512, JSON_THROW_ON_ERROR);
    $count = 0;
    $baselineCount = 0;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator('/work', FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        $relative = substr($file->getPathname(), strlen('/work/'));
        if (!$file->isFile() || $file->getExtension() !== 'php' || preg_match('#^(vendor|node_modules|addon-manager|storage|bootstrap/cache)/#', $relative)) {
            continue;
        }
        if (isset($job['baselineHashes'][$relative]) && hash_equals($job['baselineHashes'][$relative], hash_file('sha256', $file->getPathname()))) {
            ++$baselineCount;
            continue;
        }
        $pipes = [];
        $process = proc_open([PHP_BINARY, '-l', $file->getPathname()], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($process)) {
            throw new RuntimeException('Cannot lint PHP source.');
        }
        fclose($pipes[0]);
        $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        if (proc_close($process) !== 0) {
            throw new RuntimeException($relative . ': ' . trim($output));
        }
        ++$count;
    }
    foreach (['logs', 'app', 'framework/cache', 'framework/sessions', 'framework/views'] as $directory) {
        @mkdir('/work/storage/' . $directory, 0700, true);
    }
    touch('/tmp/validation.sqlite');
    // Boot against the proposed enabled set. Production state is never mounted.
    $candidate = '/work/storage/app/addon-manager/candidate-registry.json';
    mkdir(dirname($candidate), 0700, true);
    $addons = [];
    foreach ($job['manifests'] as $manifest) {
        $addons[$manifest['id']] = ['id' => $manifest['id'], 'version' => $manifest['version'], 'enabled' => true, 'manifest' => $manifest];
    }
    file_put_contents($candidate, json_encode(['addons' => $addons], JSON_THROW_ON_ERROR));
    define('ADDON_MANAGER_READINESS', true);
    define('ADDON_MANAGER_CANDIDATE_REGISTRY', $candidate);
    require '/work/vendor/autoload.php';
    $app = require '/work/bootstrap/app.php';
    $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();
    $app->make('router')->getRoutes();
    $extensionCount = 0;
    $routeCount = $pageCount = $eventCount = $scheduleCount = 0;
    foreach ($job['manifests'] as $manifest) {
        $extensions = $manifest['extensions'] ?? [];
        foreach (array_merge($extensions['routes'] ?? [], $extensions['events'] ?? [], $extensions['schedules'] ?? [], $extensions['jobs'] ?? []) as $extension) {
            [$class, $method] = explode('@', $extension['handler'], 2);
            $path = 'app/' . str_replace('\\', '/', substr($class, strlen('Pterodactyl\\'))) . '.php';
            if (!is_file('/work/' . $path)) {
                throw new RuntimeException('Declared addon handler is missing: ' . $path);
            }
            require_once '/work/' . $path;
            if (!class_exists($class, false)) {
                throw new RuntimeException('Declared addon handler class is missing: ' . $class);
            }
            $reflection = new ReflectionClass($class);
            if (!$reflection->isInstantiable()) {
                throw new RuntimeException('Addon handler is not instantiable: ' . $class);
            }
            if (!$reflection->hasMethod($method) || !$reflection->getMethod($method)->isPublic()) {
                throw new RuntimeException('Declared addon handler method is missing or not public: ' . $extension['handler']);
            }
            $app->make($class);
            ++$extensionCount;
        }
        foreach (array_merge($extensions['routes'] ?? [], $extensions['pages'] ?? []) as $extension) {
            $route = $app['router']->getRoutes()->getByName('admin.addon-manager.extensions.' . $manifest['id'] . '.' . $extension['id']);
            $middleware = ['web', 'auth.session', Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication::class, Pterodactyl\Http\Middleware\AdminAuthenticate::class];
            if ($route === null || array_diff($middleware, $route->gatherMiddleware()) !== []) {
                throw new RuntimeException('Staged addon route is missing its required authorization: ' . $extension['id']);
            }
            ++$routeCount;
        }
        foreach ($extensions['pages'] ?? [] as $page) {
            if (!$app['view']->exists($page['view'])) {
                throw new RuntimeException('Declared addon page view is missing: ' . $page['view']);
            }
            $source = $app['view']->getFinder()->find($page['view']);
            $app['blade.compiler']->compile($source);
            $compiled = $app['blade.compiler']->getCompiledPath($source);
            $pipes = [];
            $process = proc_open([PHP_BINARY, '-l', $compiled], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
            if (!is_resource($process)) {
                throw new RuntimeException('Cannot validate compiled addon page.');
            }
            fclose($pipes[0]);
            $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
            fclose($pipes[1]);
            fclose($pipes[2]);
            if (proc_close($process) !== 0) {
                throw new RuntimeException('Invalid compiled addon page ' . $page['view'] . ': ' . trim($output));
            }
            ++$pageCount;
        }
        foreach ($extensions['events'] ?? [] as $event) {
            if (!$app['events']->hasListeners($event['event'])) {
                throw new RuntimeException('Declared addon event listener was not registered.');
            }
            ++$eventCount;
        }
        if (($extensions['schedules'] ?? []) !== []) {
            $names = array_map(static fn ($event): ?string => $event->description, $app->make(Illuminate\Console\Scheduling\Schedule::class)->events());
            foreach ($extensions['schedules'] as $schedule) {
                if (!in_array('managed-addon:' . $manifest['id'] . ':' . $schedule['id'], $names, true)) {
                    throw new RuntimeException('Declared addon schedule was not registered.');
                }
                ++$scheduleCount;
            }
        }
    }
    $complete = true;
    echo json_encode(['passed' => true, 'phpFiles' => $count, 'baselinePhpFiles' => $baselineCount, 'laravelBoot' => true, 'handlerClasses' => $extensionCount, 'routes' => $routeCount, 'pages' => $pageCount, 'events' => $eventCount, 'schedules' => $scheduleCount], JSON_THROW_ON_ERROR) . "\n";
} catch (Throwable $e) {
    fwrite(STDERR, get_class($e) . ': ' . $e->getMessage() . "\n");
    exit(1);
}
