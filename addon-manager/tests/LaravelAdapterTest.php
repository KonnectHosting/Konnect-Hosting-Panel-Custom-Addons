<?php
declare(strict_types=1);

use AddonManager\Laravel\HostAdapter;
use AddonManager\Laravel\WorkerControl;
use function AddonManager\Tests\{check, rejects, same, temporary, write};

$suite->test('laravel-adapter', 'host configuration rejects linked and public state before reading bytes', function (): void {
    temporary(function (string $root): void {
        $panel = $root . '/panel';
        mkdir($panel . '/storage/app', 0700, true);
        mkdir($panel . '/public', 0700, true);
        $app = static fn (string $state): object => new class($panel, $state) {
            public function __construct(private readonly string $panel, private readonly string $state) {}
            public function basePath(): string { return $this->panel; }
            public function storagePath(string $path): string { return $this->state; }
        };
        $normal = $panel . '/storage/app/addon-manager';
        same($normal, (new HostAdapter($app($normal)))->stateRoot);
        check(!is_dir($normal), 'Reading missing host settings created private state');
        $outside = $root . '/outside';
        write($outside . '/host.json', 'invalid JSON that must never be read');
        symlink($outside, $normal);
        rejects(static fn () => new HostAdapter($app($normal)), '/symbolic links/i');
        unlink($normal);
        mkdir($normal, 0700);
        symlink($outside . '/host.json', $normal . '/host.json');
        rejects(static fn () => new HostAdapter($app($normal)), '/symbolic links/i');
        rejects(static fn () => new HostAdapter($app($normal), []), '/symbolic links/i');
        foreach ([$panel . '/public/manager-state', $panel . '/storage/app/public/manager-state'] as $public) {
            write($public . '/host.json', 'invalid JSON that must never be read');
            rejects(static fn () => new HostAdapter($app($public)), '/publicly served/i');
        }
        rejects(static fn () => new HostAdapter($app($panel . '/public/./manager-state')), '/traversal/i');
        rejects(static fn () => new HostAdapter($app($panel . '//public/manager-state')), '/publicly served/i');
    });
});

/** Replace only the executable for a disposable process fixture, with no services. */
function addonManagerSyntheticSupervisor(string $binary, int $timeout = 1): WorkerControl
{
    $class = new ReflectionClass(WorkerControl::class);
    $control = $class->newInstanceWithoutConstructor();
    foreach (['binary' => $binary, 'groups' => ['fixturequeue', 'fixtureweb'], 'timeout' => $timeout] as $name => $value) {
        $class->getProperty($name)->setValue($control, $value);
    }
    return $control;
}

$suite->test('laravel-adapter', 'supervisor deadline kills a child that ignores termination without hanging', function (): void {
    temporary(function (string $root): void {
        $binary = $root . '/supervisorctl';
        write($binary, "#!/bin/sh\ntrap '' TERM\nwhile :; do :; done\n");
        chmod($binary, 0700);
        $start = microtime(true);
        $doctor = addonManagerSyntheticSupervisor($binary)->doctor();
        check(microtime(true) - $start < 7, 'Supervisor timeout did not bound both group checks');
        same(false, $doctor['ready']);
        same(2, count($doctor['checks']));
        foreach ($doctor['checks'] as $result) {
            check(str_contains($result['message'], 'timed out'), 'Supervisor failed for a reason other than its deadline');
        }
    });
});

$suite->test('laravel-adapter', 'supervisor stderr output is bounded and cannot exhaust the worker', function (): void {
    temporary(function (string $root): void {
        $binary = $root . '/supervisorctl';
        write($binary, "#!/bin/sh\nwhile :; do printf 'synthetic diagnostic block that exceeds the control output budget\\n' >&2; done\n");
        chmod($binary, 0700);
        $doctor = addonManagerSyntheticSupervisor($binary, 5)->doctor();
        same(false, $doctor['ready']);
        foreach ($doctor['checks'] as $result) {
            check(str_contains($result['message'], 'output limit'), 'Supervisor diagnostics were not bounded');
        }
    });
});

$suite->test('laravel-adapter', 'invalid supervisor deadlines reject before locating or invoking a service binary', function (): void {
    foreach ([null, false, 0, -1, 301, '30', 2.5] as $timeout) {
        rejects(static fn () => new WorkerControl(['driver' => 'supervisor', 'groups' => ['fixturequeue', 'fixtureweb'], 'timeout' => $timeout]), '/timeout must/i');
    }
});
