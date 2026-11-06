#!/usr/bin/env php
<?php
declare(strict_types=1);

require dirname(__DIR__) . '/bootstrap.php';
require __DIR__ . '/Support.php';

use AddonManager\Core\ManifestValidator;
use AddonManager\Core\PackageValidator;
use AddonManager\Laravel\WorkerControl;
use AddonManager\Runner\IsolatedRunner;
use AddonManager\Storage\Files;
use AddonManager\Tests\Suite;
use function AddonManager\Tests\{check, fileDeclaration, manifest, rejects, remove, same, write};

// A separate container mounts a synthetic symlink into a permitted socket path.
// No real socket, Panel, environment file, or state is mounted into this helper.
if (($argv[1] ?? '') === '--socket-symlink-child') {
    $runner = new IsolatedRunner('/missing-panel', '/missing-state', ['mode' => 'docker', 'phpImage' => 'sha256:' . str_repeat('a', 64), 'dockerHost' => 'unix:///run/user/1000/docker.sock']);
    fwrite(STDOUT, json_encode($runner->doctor(), JSON_THROW_ON_ERROR) . PHP_EOL);
    exit(0);
}

// A synthetic executable satisfies the binary prerequisite without granting
// supervisor access. Construction must validate groups before any service call.
if (($argv[1] ?? '') === '--worker-policy-child') {
    $settings = ['driver' => 'supervisor', 'binary' => '/usr/local/bin/supervisorctl', 'groups' => ['pteroq', 'panel-php-fpm']];
    new WorkerControl($settings);
    foreach (['addonmanager', 'addon-manager-worker', 'ADDON_MANAGER_WORKER', 'Panel-AddonManager'] as $group) {
        $invalid = array_replace($settings, ['groups' => ['pteroq', $group]]);
        rejects(static fn () => new WorkerControl($invalid), '/management-worker/i');
    }
    fwrite(STDOUT, 'worker policy ready' . PHP_EOL);
    exit(0);
}

function runnerCommand(array $arguments, int $timeout = 45): array
{
    $pipes = [];
    $process = proc_open($arguments, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    check(is_resource($process), 'Cannot start Docker fixture command');
    fclose($pipes[0]);
    stream_set_blocking($pipes[1], false);
    stream_set_blocking($pipes[2], false);
    $stdout = $stderr = '';
    $deadline = microtime(true) + $timeout;
    do {
        $stdout .= stream_get_contents($pipes[1], 65536);
        $stderr .= stream_get_contents($pipes[2], 65536);
        $status = proc_get_status($process);
        if (!$status['running']) break;
        if (microtime(true) > $deadline) {
            proc_terminate($process, 9);
            fclose($pipes[1]);
            fclose($pipes[2]);
            proc_close($process);
            throw new RuntimeException('Docker fixture command timed out');
        }
        usleep(10000);
    } while (true);
    $stdout .= stream_get_contents($pipes[1]);
    $stderr .= stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    $closed = proc_close($process);
    return ['exit' => $status['exitcode'] >= 0 ? $status['exitcode'] : $closed, 'stdout' => $stdout, 'stderr' => $stderr];
}

function runnerManifest(string $id): array
{
    $definition = manifest($id);
    unset($definition['compatibility']['arix'], $definition['compatibility']['addonPack']);
    return $definition;
}

function runnerStage(array $registry, string $root, string $name): string
{
    $stage = $root . '/' . $name;
    Files::copyInventory($registry['baselineRoot'], $stage, $registry['baselineInventory']);
    return $stage;
}

try {
    $panel = realpath(getenv('ADDON_MANAGER_TEST_PANEL_ROOT') ?: '');
    if ($panel === false || !is_file($panel . '/storage/app/addon-manager/registry.json')) throw new RuntimeException('Set ADDON_MANAGER_TEST_PANEL_ROOT to an installed disposable Panel fixture.');
    if (getenv('ADDON_MANAGER_ALLOW_DISPOSABLE_TESTS') !== '1') throw new RuntimeException('Set ADDON_MANAGER_ALLOW_DISPOSABLE_TESTS=1 before running executable fixture checks.');
    $image = getenv('ADDON_MANAGER_TEST_PHP_IMAGE') ?: '';
    if (!preg_match('/^(?:sha256:[0-9a-f]{64}|[A-Za-z0-9][A-Za-z0-9._\/:\-]*@sha256:[0-9a-f]{64})$/D', $image)) throw new RuntimeException('Set ADDON_MANAGER_TEST_PHP_IMAGE to an available immutable Docker image ID or digest.');
    check(!function_exists('posix_geteuid') || posix_geteuid() !== 0, 'Run this suite as the unprivileged deployment user.');
    $state = $panel . '/storage/app/addon-manager';
    $registry = Files::json($state . '/registry.json');
    check(is_file($panel . '/.env'), 'The fixture needs an environment file so its isolation can be tested');
    $socket = getenv('ADDON_MANAGER_TEST_DOCKER_HOST') ?: 'unix:///var/run/docker.sock';
    check(preg_match('#^unix:///(?:var/run|run/user/[0-9]+)/docker\.sock$#D', $socket) === 1, 'Use a supported local Docker socket for the executable fixture suite');
    $docker = ['docker', '--host', $socket];
    $info = runnerCommand([...$docker, 'info', '--format', '{{json .SecurityOptions}}']);
    same(0, $info['exit'], 'Fixture Docker daemon is unavailable: ' . $info['stderr']);
    $securityOptions = json_decode(trim($info['stdout']), true, 512, JSON_THROW_ON_ERROR);
    $rootless = count(array_filter($securityOptions, static fn (string $option): bool => str_contains($option, 'rootless'))) > 0;
    $allowRootful = getenv('ADDON_MANAGER_TEST_ALLOW_ROOTFUL_DAEMON') === '1';
    if (!$rootless && !$allowRootful) throw new RuntimeException('This development daemon is rootful. Set ADDON_MANAGER_TEST_ALLOW_ROOTFUL_DAEMON=1 explicitly for the disposable development fixture.');
    $config = ['mode' => 'docker', 'phpImage' => $image, 'dockerHost' => $socket, 'timeout' => 90, 'memory' => '768m', 'cpus' => 2];
    if ($allowRootful) $config['allowRootfulDaemon'] = true;
    $runner = new IsolatedRunner($panel, $state, $config);
    $root = $state . '/runner-acceptance-' . bin2hex(random_bytes(8));
    mkdir($root, 0700);
    $suite = new Suite();
    // Real Panel inventories can contain large prebuilt asset trees. Each case
    // owns its stage, so release it before the next case instead of retaining
    // every baseline copy until the entire suite has finished.
    $runnerTest = static function (string $name, callable $action) use ($suite, $root): void {
        $suite->test('runner', $name, static function () use ($action, $root): void {
            try { $action(); }
            finally {
                foreach (new FilesystemIterator($root) as $entry) remove($entry->getPathname());
            }
        });
    };

    $runnerTest('rootful daemon requires explicit development opt-in', function () use ($panel, $state, $config, $rootless): void {
        $default = $config;
        unset($default['allowRootfulDaemon']);
        $doctor = (new IsolatedRunner($panel, $state, $default))->doctor();
        same($rootless, $doctor['ready']);
        if (!$rootless) check(str_contains(strtolower(json_encode($doctor)), 'rootless'), 'Rootful default rejection lost its reason');
        same(true, (new IsolatedRunner($panel, $state, $config))->doctor()['ready']);
    });

    $runnerTest('mutable and missing images cannot establish isolation readiness', function () use ($panel, $state, $config): void {
        foreach (['addon-manager-dev:latest', 'php:8.3-cli', 'sha256:1234', 'sha256:' . str_repeat('0', 64)] as $image) {
            $invalid = $config;
            $invalid['phpImage'] = $image;
            $doctor = (new IsolatedRunner($panel, $state, $invalid))->doctor();
            same(false, $doctor['ready'], 'Runner accepted an unsupported image ' . $image);
            check(preg_match('/immutable|image|failed/i', json_encode($doctor)) === 1, 'Image rejection has no useful diagnosis');
        }
    });

    $runnerTest('remote and unsupported Docker sockets reject before connecting', function () use ($panel, $state, $config): void {
        foreach (['tcp://127.0.0.1:2375', 'ssh://docker@example.invalid', 'unix:///tmp/docker.sock'] as $socket) {
            $invalid = $config;
            $invalid['dockerHost'] = $socket;
            $doctor = (new IsolatedRunner($panel, $state, $invalid))->doctor();
            same(false, $doctor['ready']);
            check(preg_match('/local Unix|socket|endpoint/i', json_encode($doctor)) === 1, 'Socket rejection lost its policy reason');
        }
    });

    $runnerTest('symlinked socket at an otherwise permitted path rejects', function () use ($root, $docker, $image): void {
        $directory = $root . '/socket-fixture';
        mkdir($directory, 0700);
        symlink('/var/run/docker.sock', $directory . '/docker.sock');
        $result = runnerCommand([...$docker, 'run', '--rm', '--network', 'none', '--read-only', '--user', '1000:1000', '--mount', 'type=bind,src=' . $directory . ',dst=/run/user/1000,readonly', '--mount', 'type=bind,src=' . dirname(__DIR__) . ',dst=/manager,readonly', $image, 'php', '/manager/tests/RunnerIntegration.php', '--socket-symlink-child']);
        same(0, $result['exit'], $result['stderr']);
        $doctor = json_decode(trim($result['stdout']), true, 512, JSON_THROW_ON_ERROR);
        same(false, $doctor['ready']);
        check(str_contains(strtolower(json_encode($doctor)), 'symlink'), 'Synthetic socket was rejected for a different reason');
    });

    $runnerTest('supervisor policy excludes the management worker across neutral group spellings', function () use ($root, $docker, $image): void {
        $binary = $root . '/synthetic-supervisorctl';
        write($binary, "#!/bin/sh\nexit 99\n");
        check(chmod($binary, 0700), 'Cannot prepare synthetic supervisor executable');
        $result = runnerCommand([...$docker, 'run', '--rm', '--network', 'none', '--read-only', '--user', '1000:1000', '--mount', 'type=bind,src=' . $binary . ',dst=/usr/local/bin/supervisorctl,readonly', '--mount', 'type=bind,src=' . dirname(__DIR__) . ',dst=/manager,readonly', $image, 'php', '/manager/tests/RunnerIntegration.php', '--worker-policy-child']);
        same(0, $result['exit'], $result['stderr']);
        same('worker policy ready', trim($result['stdout']));
        same('', $result['stderr']);
    });

    $runnerTest('stage containment, symbolic links and protected mounted paths reject', function () use ($root, $state, $runner): void {
        $outside = dirname($state) . '/runner-outside-' . bin2hex(random_bytes(8));
        mkdir($outside, 0700);
        try {
            rejects(static fn () => $runner->verifyStage($outside, [], ['id' => 'outside']), '/outside|allowed root/i');
            symlink($outside, $root . '/escaping-stage');
            rejects(static fn () => $runner->verifyStage($root . '/escaping-stage', [], ['id' => 'escaping']), '/outside|allowed root|symbolic|symlink/i');
            $internal = $root . '/internal-link';
            mkdir($internal, 0700);
            symlink($outside, $internal . '/payload-link');
            rejects(static fn () => $runner->verifyStage($internal, [], ['id' => 'internal']), '/symlink/i');
            foreach (['.env', '.git', 'vendor', 'node_modules', 'addon-manager'] as $path) {
                $stage = $root . '/protected-' . str_replace('.', '', $path);
                mkdir($stage, 0700);
                if ($path === '.env') write($stage . '/.env', 'SYNTHETIC_FIXTURE_ONLY=true');
                else mkdir($stage . '/' . $path, 0700);
                rejects(static fn () => $runner->verifyStage($stage, [], ['id' => 'protected']), '/protected/i');
            }
        } finally { remove($outside); }
    });

    $runnerTest('vendor directory cannot escape the configured Panel root through a symlink', function () use ($panel, $state, $root, $config): void {
        $fakePanel = $root . '/fake-panel';
        mkdir($fakePanel, 0700);
        symlink($panel . '/vendor', $fakePanel . '/vendor');
        $stage = $root . '/vendor-escape';
        mkdir($stage, 0700);
        rejects(static fn () => (new IsolatedRunner($fakePanel, $state, $config))->verifyStage($stage, [], ['id' => 'vendor-escape']), '/outside|allowed root|missing|symbolic|symlink/i');
    });

    $runnerTest('nested credential stores and authenticated package configuration never enter a container', function () use ($root, $runner): void {
        $cases = [
            'nested/.ssh/id_rsa' => 'synthetic private key',
            'nested/.AWS/credentials' => 'synthetic cloud credential',
            'nested/.docker/config.json' => '{"auths":{"registry.invalid":{"auth":"synthetic"}}}',
            'nested/.netrc' => 'machine registry.invalid login fixture password synthetic',
            'nested/.npmrc' => '//registry.invalid/:_authToken=synthetic',
            'nested/.yarnrc.yml' => 'npmAuthToken: synthetic',
        ];
        foreach ($cases as $relative => $bytes) {
            $stage = $root . '/credentials-' . bin2hex(random_bytes(4));
            write($stage . '/' . $relative, $bytes);
            $before = Files::inventory($stage);
            rejects(static fn () => $runner->verifyStage($stage, [], ['id' => 'credential-boundary']), '/credentials|private-key/i');
            same($before, Files::inventory($stage), 'Credential rejection changed the staged files');
        }
        $stage = $root . '/ordinary-package-configuration';
        write($stage . '/.npmrc', 'registry=https://registry.npmjs.org/');
        same($stage, (new ReflectionMethod(IsolatedRunner::class, 'stage'))->invoke($runner, $stage), 'Ordinary build configuration was rejected');
    });

    $runnerTest('Docker mount CSV delimiters reject before starting a container', function () use ($root, $runner): void {
        $mount = new ReflectionMethod(IsolatedRunner::class, 'mount');
        foreach ([',dst=', '"quoted"', "line\nbreak"] as $name) {
            $path = $root . '/mount-' . $name;
            mkdir($path, 0700);
            rejects(static fn () => $mount->invoke($runner, $path, '/work'), '/CSV delimiters|control characters/i');
        }
        $safe = $root . '/ordinary workspace';
        mkdir($safe, 0700);
        same('type=bind,src=' . $safe . ',dst=/work,readonly', $mount->invoke($runner, $safe, '/work'));
    });

    $runnerTest('real candidate boots Laravel and validates SDK page and jobs within isolation boundaries', function () use ($panel, $registry, $root, $runner): void {
        $stage = runnerStage($registry, $root, 'valid');
        $exampleRoot = dirname(__DIR__) . '/sdk/examples/basic-admin-page';
        $example = PackageValidator::validate($exampleRoot);
        foreach ($example['files'] as $file) write($stage . '/' . $file['target'], file_get_contents($exampleRoot . '/' . $file['source']));
        $environmentName = 'ADDON_MANAGER_RUNNER_SYNTHETIC_' . strtoupper(bin2hex(random_bytes(8)));
        $boundary = <<<'PHP'
<?php
namespace Pterodactyl\Addons\RunnerFixture;
if (file_exists('/work/.env') || file_exists(__HOST_ENV__) || getenv(__SYNTHETIC_ENV__) !== false) throw new \RuntimeException('Live environment boundary was exposed');
if (file_exists('/var/run/docker.sock') || file_exists('/run/user/1000/docker.sock')) throw new \RuntimeException('Host Docker socket was exposed to addon code');
$interfaces = array_map('basename', glob('/sys/class/net/*') ?: []);
sort($interfaces);
if ($interfaces !== ['lo']) throw new \RuntimeException('Addon container has an external network interface');
foreach (['/job/addon-manager-test-write', '/runner/addon-manager-test-write', '/work/resources/views/addon-manager-test-write', '/work/vendor/addon-manager-test-write', '/work/addon-manager/tests/addon-manager-test-write', '/etc/addon-manager-test-write'] as $path) {
    if (@file_put_contents($path, 'synthetic write probe') !== false) throw new \RuntimeException('Read-only filesystem boundary allowed a write: ' . $path);
}
final class Boundary { public function run(mixed $payload = null): array { return []; } }
PHP;
        $boundary = str_replace(['__HOST_ENV__', '__SYNTHETIC_ENV__'], [var_export($panel . '/.env', true), var_export($environmentName, true)], $boundary);
        $definition = runnerManifest('test.runner-boundary');
        $definition['files'][] = fileDeclaration('payload/Boundary.php', 'app/Addons/RunnerFixture/Boundary.php', $boundary);
        $definition['extensions'] = ['jobs' => [['id' => 'boundary-job', 'handler' => 'Pterodactyl\\Addons\\RunnerFixture\\Boundary@run', 'permission' => 'system']]];
        $definition = ManifestValidator::validate($definition);
        write($stage . '/app/Addons/RunnerFixture/Boundary.php', $boundary);
        $before = Files::inventory($stage);
        putenv($environmentName . '=synthetic-test-value');
        try { $result = $runner->verifyStage($stage, [$example, $definition], ['id' => 'valid-isolation-fixture']); }
        finally {
            putenv($environmentName);
            foreach ([$panel . '/vendor/addon-manager-test-write', dirname(__DIR__) . '/src/Runner/addon-manager-test-write', dirname(__DIR__) . '/tests/addon-manager-test-write'] as $probe) if (is_file($probe)) unlink($probe);
        }
        same(true, $result['isolated']);
        same(true, $result['checks']['passed']);
        same(true, $result['checks']['laravelBoot']);
        $declaredPhpFiles = count(array_filter(array_merge($example['files'], $definition['files']), static fn (array $file): bool => str_ends_with($file['target'], '.php')));
        check($result['checks']['phpFiles'] >= $declaredPhpFiles, 'Container did not lint all newly declared PHP files');
        check($result['checks']['baselinePhpFiles'] > 100, 'Container did not verify the actual Panel baseline PHP hashes');
        same(1, $result['checks']['handlerClasses'], 'Declared job was not reflected');
        same($before, Files::inventory($stage), 'Container validation changed staged files outside disposable runtime mounts');
    });

    $runnerTest('scheduled extensions resolve against the empty synthetic database without telemetry settings', function () use ($registry, $root, $runner): void {
        $stage = runnerStage($registry, $root, 'scheduled-extension');
        $source = <<<'PHP'
<?php
namespace Pterodactyl\Addons\RunnerScheduleFixture;
final class Probe {
    public function __construct() {
        if (config('pterodactyl.telemetry.enabled') !== false) throw new \RuntimeException('Synthetic telemetry was not disabled');
        if (app('db')->connection()->getDriverName() !== 'sqlite' || app('db')->connection()->getSchemaBuilder()->hasTable('settings')) {
            throw new \RuntimeException('Schedule validation must use an empty synthetic database');
        }
    }
    public function handle(): void { throw new \RuntimeException('Validation must not execute scheduled handlers'); }
}
PHP;
        $definition = runnerManifest('test.runner-schedule');
        $definition['files'][] = fileDeclaration('payload/Probe.php', 'app/Addons/RunnerScheduleFixture/Probe.php', $source);
        $definition['extensions'] = ['schedules' => [['id' => 'probe-schedule', 'handler' => 'Pterodactyl\\Addons\\RunnerScheduleFixture\\Probe@handle', 'frequency' => 'everyMinute', 'permission' => 'system']]];
        $definition = ManifestValidator::validate($definition);
        write($stage . '/app/Addons/RunnerScheduleFixture/Probe.php', $source);
        $before = Files::inventory($stage);
        $result = $runner->verifyStage($stage, [$definition], ['id' => 'scheduled-extension-empty-database']);
        same(true, $result['checks']['passed']);
        same(1, $result['checks']['schedules']);
        same($before, Files::inventory($stage), 'Synthetic scheduler validation changed staged source');
    });

    foreach ([false, true] as $changed) {
        $runnerTest($changed ? 'changed unused baseline PHP is linted and rejected' : 'unchanged unused baseline PHP is hash verified without blocking Laravel boot', function () use ($changed, $panel, $state, $registry, $root, $config): void {
            // The synthetic trusted snapshot is private to this case. Neither
            // the fixture source nor its actual manager registry is modified.
            $privateState = $root . '/baseline-lint-' . ($changed ? 'changed' : 'unchanged');
            mkdir($privateState, 0700);
            $stage = runnerStage($registry, $privateState, 'staging');
            $target = 'app/UnusedBaselineFixture.php';
            $invalid = '<?php namespace Pterodactyl\\UnusedBaselineFixture; final class Invalid { private string $value = getenv("UNUSED_FIXTURE"); }';
            write($stage . '/' . $target, $invalid);
            $trusted = $registry;
            $trusted['baselineInventory'][$target] = hash('sha256', $invalid);
            Files::writeJson($privateState . '/registry.json', $trusted);
            $liveRegistryHash = hash_file('sha256', $state . '/registry.json');
            $privateRegistryHash = hash_file('sha256', $privateState . '/registry.json');
            if ($changed) write($stage . '/' . $target, $invalid . "\n// Changed after the frozen baseline snapshot.\n");
            $before = Files::inventory($stage);
            $privateRunner = new IsolatedRunner($panel, $privateState, $config);
            if ($changed) {
                rejects(static fn () => $privateRunner->verifyStage($stage, [], ['id' => 'changed-baseline-php']), '/UnusedBaselineFixture\.php.*(?:constant expression|syntax|parse)/is');
            } else {
                $result = $privateRunner->verifyStage($stage, [], ['id' => 'unchanged-baseline-php']);
                same(true, $result['isolated']);
                same(true, $result['checks']['passed']);
                same(true, $result['checks']['laravelBoot']);
                same(0, $result['checks']['phpFiles'], 'An unchanged baseline must permit zero newly linted PHP files');
                check($result['checks']['baselinePhpFiles'] > 100, 'Frozen baseline source was not hash verified');
            }
            same($before, Files::inventory($stage), 'Baseline lint validation changed staged source');
            same($privateRegistryHash, hash_file('sha256', $privateState . '/registry.json'), 'Runner rewrote the trusted test snapshot');
            same($liveRegistryHash, hash_file('sha256', $state . '/registry.json'), 'Runner rewrote the actual fixture registry');
            check(!is_file($panel . '/' . $target) && !is_file($registry['baselineRoot'] . '/' . $target), 'Synthetic invalid source escaped its private stage');
        });
    }

    $runnerTest('actual container rejects declared invalid PHP before reporting successful boot', function () use ($registry, $root, $runner): void {
        $stage = runnerStage($registry, $root, 'invalid-php');
        $definition = runnerManifest('test.runner-invalid');
        $bytes = '<?php function broken( {';
        $definition['files'][] = fileDeclaration('payload/Broken.php', 'app/Addons/RunnerFixture/Broken.php', $bytes);
        write($stage . '/app/Addons/RunnerFixture/Broken.php', $bytes);
        rejects(static fn () => $runner->verifyStage($stage, [ManifestValidator::validate($definition)], ['id' => 'invalid-php']), '/parse|syntax/i');
    });

    foreach (['routes', 'jobs'] as $kind) {
        $runnerTest('actual container rejects missing declared ' . $kind . ' handler', function () use ($kind, $registry, $root, $runner): void {
            $stage = runnerStage($registry, $root, 'missing-' . $kind);
            $definition = runnerManifest('test.runner-missing-' . $kind);
            $definition['files'][] = fileDeclaration('payload/Missing.php', 'app/Addons/RunnerFixture/Missing.php', '<?php namespace Pterodactyl\\Addons\\RunnerFixture; final class Missing { public function run(): void {} }');
            $extension = ['id' => 'missing-handler', 'handler' => 'Pterodactyl\\Addons\\RunnerFixture\\Missing@run', 'permission' => $kind === 'routes' ? 'admin' : 'system'];
            if ($kind === 'routes') $extension += ['method' => 'GET', 'path' => 'probe'];
            $definition['extensions'] = [$kind => [$extension]];
            rejects(static fn () => $runner->verifyStage($stage, [ManifestValidator::validate($definition)], ['id' => 'missing-' . $kind]), '/Declared addon handler is missing|class.*missing/i');
        });
    }

    $runnerTest('actual container rejects a declared private job method', function () use ($registry, $root, $runner): void {
        $stage = runnerStage($registry, $root, 'private-job');
        $bytes = '<?php namespace Pterodactyl\\Addons\\RunnerFixture; final class PrivateJob { private function run(): void {} }';
        $definition = runnerManifest('test.runner-private');
        $definition['files'][] = fileDeclaration('payload/PrivateJob.php', 'app/Addons/RunnerFixture/PrivateJob.php', $bytes);
        $definition['extensions'] = ['jobs' => [['id' => 'private-job', 'handler' => 'Pterodactyl\\Addons\\RunnerFixture\\PrivateJob@run', 'permission' => 'system']]];
        write($stage . '/app/Addons/RunnerFixture/PrivateJob.php', $bytes);
        rejects(static fn () => $runner->verifyStage($stage, [ManifestValidator::validate($definition)], ['id' => 'private-job']), '/method.*missing|not public/i');
    });

    $runnerTest('premature addon exit cannot impersonate successful validation', function () use ($registry, $root, $runner): void {
        $stage = runnerStage($registry, $root, 'premature-exit');
        $bytes = '<?php namespace Pterodactyl\\Addons\\RunnerFixture; echo "{\\"passed\\":true,\\"laravelBoot\\":true}\\n"; exit(0); final class Premature { public function run(): void {} }';
        $definition = runnerManifest('test.runner-premature');
        $definition['files'][] = fileDeclaration('payload/Premature.php', 'app/Addons/RunnerFixture/Premature.php', $bytes);
        $definition['extensions'] = ['jobs' => [['id' => 'premature-job', 'handler' => 'Pterodactyl\\Addons\\RunnerFixture\\Premature@run', 'permission' => 'system']]];
        write($stage . '/app/Addons/RunnerFixture/Premature.php', $bytes);
        rejects(static fn () => $runner->verifyStage($stage, [ManifestValidator::validate($definition)], ['id' => 'premature-exit']), '/ended before completing validation/i');
    });

    $runnerTest('staged PHP cannot disable completion guard through global variables and spoof a full result', function () use ($registry, $root, $runner): void {
        $stage = runnerStage($registry, $root, 'global-completion-spoof');
        $fake = json_encode(['passed' => true, 'phpFiles' => 1, 'baselinePhpFiles' => 1000, 'laravelBoot' => true, 'handlerClasses' => 1, 'routes' => 0, 'pages' => 0, 'events' => 0, 'schedules' => 0], JSON_THROW_ON_ERROR);
        $bytes = '<?php namespace Pterodactyl\\Addons\\RunnerFixture; global $complete; $complete = true; echo ' . var_export($fake . "\n", true) . '; exit(0); final class Spoof { public function run(): void {} }';
        $definition = runnerManifest('test.runner-spoof');
        $definition['files'][] = fileDeclaration('payload/Spoof.php', 'app/Addons/RunnerFixture/Spoof.php', $bytes);
        $definition['extensions'] = ['jobs' => [['id' => 'spoof-job', 'handler' => 'Pterodactyl\\Addons\\RunnerFixture\\Spoof@run', 'permission' => 'system']]];
        write($stage . '/app/Addons/RunnerFixture/Spoof.php', $bytes);
        rejects(static fn () => $runner->verifyStage($stage, [ManifestValidator::validate($definition)], ['id' => 'global-completion-spoof']), '/ended before completing validation/i');
    });

    $runnerTest('actual container rejects a registered page whose declared view is missing', function () use ($registry, $root, $runner): void {
        $stage = runnerStage($registry, $root, 'missing-view');
        $definition = PackageValidator::validate(dirname(__DIR__) . '/sdk/examples/basic-admin-page');
        rejects(static fn () => $runner->verifyStage($stage, [$definition], ['id' => 'missing-view']), '/view.*missing/i');
    });

    $runnerTest('actual container rejects malformed Blade after compiling a declared page', function () use ($registry, $root, $runner): void {
        $stage = runnerStage($registry, $root, 'invalid-blade');
        $definition = PackageValidator::validate(dirname(__DIR__) . '/sdk/examples/basic-admin-page');
        $bytes = "@if (true)\n<p>Unterminated Blade block</p>\n";
        $definition['files'][0]['sha256'] = hash('sha256', $bytes);
        write($stage . '/' . $definition['files'][0]['target'], $bytes);
        $rawLint = runnerCommand([PHP_BINARY, '-l', $stage . '/' . $definition['files'][0]['target']]);
        same(0, $rawLint['exit'], 'Fixture must pass raw PHP lint to exercise compiled Blade validation');
        $before = Files::inventory($stage);
        rejects(static fn () => $runner->verifyStage($stage, [ManifestValidator::validate($definition)], ['id' => 'invalid-blade']), '/Invalid compiled addon page.*(?:syntax|parse|unexpected)/is');
        same($before, Files::inventory($stage), 'Failed Blade compilation changed staged source');
    });

    try { $status = $suite->run(array_slice($argv, 1)); }
    finally { remove($root); }
    exit($status);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(2);
}
