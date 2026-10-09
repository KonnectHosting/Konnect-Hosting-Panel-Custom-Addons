<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Runner;

use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use RuntimeException;
use Throwable;
use Konnect\AddonManager\Core\Paths;
use Konnect\AddonManager\Storage\Files;

/** Executes staging code in a restricted container, never with the live environment. */
final class IsolatedRunner
{
    private ?bool $rootless = null;

    public function __construct(
        private readonly string $panelRoot,
        private readonly string $stateRoot,
        private readonly array $config = [],
    ) {
    }

    public function doctor(): array
    {
        $checks = [];
        $mode = ($this->config['mode'] ?? '') === 'docker';
        $checks[] = ['name' => 'isolation', 'passed' => $mode, 'message' => $mode ? 'Restricted Docker staging configured.' : 'Configure an isolated Docker runner before installing addons.'];
        if ($mode) {
            try {
                $this->image('phpImage');
                $this->security();
                $checks[] = ['name' => 'docker', 'passed' => true, 'message' => 'Docker is reachable and the pinned PHP image is available.'];
            } catch (Throwable $e) {
                $checks[] = ['name' => 'docker', 'passed' => false, 'message' => $e->getMessage()];
            }
        }
        return ['ready' => !in_array(false, array_column($checks, 'passed'), true), 'mode' => 'docker', 'checks' => $checks];
    }

    public function verifyStage(string $stageRoot, array $manifests, array $operation): array
    {
        $stage = $this->stage($stageRoot);
        $image = $this->image('phpImage');
        $job = $this->job($manifests, $operation);
        try {
            $command = $this->container($image, $stage, $job, false);
            $command = array_merge($command, ['php', '/runner/probe.php']);
            $result = $this->process($command, $this->timeout());
            $checks = json_decode(trim($result['stdout']), true, 512, JSON_THROW_ON_ERROR);
            $expected = ['handlerClasses' => 0, 'routes' => 0, 'pages' => 0, 'events' => 0, 'schedules' => 0];
            foreach ($manifests as $manifest) {
                $extensions = $manifest['extensions'] ?? [];
                foreach (['routes', 'events', 'schedules', 'jobs'] as $kind) {
                    $expected['handlerClasses'] += count($extensions[$kind] ?? []);
                }
                foreach (['pages', 'events', 'schedules'] as $kind) {
                    $expected[$kind] += count($extensions[$kind] ?? []);
                }
                $expected['routes'] += count($extensions['routes'] ?? []) + count($extensions['pages'] ?? []);
            }
            if (!is_array($checks) || ($checks['passed'] ?? false) !== true || ($checks['laravelBoot'] ?? false) !== true || !is_int($checks['phpFiles'] ?? null) || $checks['phpFiles'] < 0 || !is_int($checks['baselinePhpFiles'] ?? null) || $checks['baselinePhpFiles'] + $checks['phpFiles'] < 1 || array_intersect_key($checks, $expected) !== $expected) {
                throw new RuntimeException('Isolated PHP validation did not produce a successful result.');
            }
            return ['isolated' => true, 'checks' => $checks];
        } finally {
            $this->removeJob($job);
            $this->removeMountPoints($stage);
        }
    }

    public function build(string $stageRoot, array $manifests, array $operation): array
    {
        $plan = $operation['buildPlan'] ?? [];
        $required = ($plan['required'] ?? false) || array_filter($manifests, static fn (array $m): bool => ($m['build']['mode'] ?? 'none') === 'panel');
        if (!$required) {
            return ['isolated' => true, 'outputs' => []];
        }
        if (($plan['profile'] ?? 'panel-v1') !== 'panel-v1') {
            throw new RuntimeException('Unsupported frontend build profile.');
        }
        $stage = $this->stage($stageRoot);
        $image = $this->image('nodeImage');
        $modules = $this->containedDirectory($this->panelRoot . '/node_modules', $this->panelRoot);
        if (!is_file($modules . '/.bin/webpack')) {
            throw new RuntimeException('The matched Panel frontend dependencies are missing; install its frozen lockfile dependencies before using source-patching addons.');
        }
        $package = json_decode((string) file_get_contents($stage . '/package.json'), true, 512, JSON_THROW_ON_ERROR);
        $expected = 'yarn run clean && cross-env NODE_ENV=production ./node_modules/.bin/webpack --mode production';
        if (($package['scripts']['build:production'] ?? null) !== $expected || ($package['scripts']['clean'] ?? null) !== 'cd public/assets && find . \\( -name "*.js" -o -name "*.map" \\) -type f -delete') {
            throw new RuntimeException('Panel build scripts do not match the supported panel-v1 build profile.');
        }
        $job = $this->job($manifests, $operation);
        try {
            $command = $this->container($image, $stage, $job, true);
            $assets = $this->containedDirectory($stage . '/public/assets', $stage);
            $command = array_merge($command, ['--mount', 'type=bind,src=' . $modules . ',dst=/work/node_modules,readonly', '--mount', 'type=bind,src=' . $assets . ',dst=/baseline-assets,readonly', '--tmpfs', '/work/public/assets:rw,nosuid,size=128m,uid=' . ($this->rootless ? 0 : posix_geteuid()) . ',gid=' . ($this->rootless ? 0 : posix_getegid()), $image, 'node', '/runner/build.js']);
            $this->process($command, $this->timeout(), $job . '/output.bin', 129 * 1024 * 1024);
            $this->receiveAssets($job . '/output.bin', $stage);
            $outputs = [];
            $directory = $stage . '/public/assets';
            if (!is_file($directory . '/manifest.json')) {
                throw new RuntimeException('Frontend build did not produce public/assets/manifest.json.');
            }
            foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)) as $file) {
                if ($file->isLink()) {
                    throw new RuntimeException('Generated frontend assets must not contain symlinks.');
                }
                if ($file->isFile()) {
                    $outputs[] = substr($file->getPathname(), strlen($stage) + 1);
                }
            }
            sort($outputs, SORT_STRING);
            return ['isolated' => true, 'outputs' => $outputs];
        } finally {
            $this->removeJob($job);
            $this->removeMountPoints($stage);
        }
    }

    private function container(string $image, string $stage, string $job, bool $building): array
    {
        if (($this->config['mode'] ?? '') !== 'docker') {
            throw new RuntimeException('An isolated Docker runner must be configured.');
        }
        $this->security();
        $memory = (string) ($this->config[$building ? 'buildMemory' : 'memory'] ?? ($building ? '2g' : '512m'));
        if (!preg_match('/^[1-9][0-9]*(?:m|g)$/D', $memory)) {
            throw new RuntimeException('Invalid runner memory limit.');
        }
        $cpus = (string) ($this->config['cpus'] ?? 2);
        if (!preg_match('/^[1-9](?:\.[0-9])?$/D', $cpus)) {
            throw new RuntimeException('Invalid runner CPU limit.');
        }
        $uid = function_exists('posix_geteuid') ? posix_geteuid() : 1000;
        $gid = function_exists('posix_getegid') ? posix_getegid() : 1000;
        if ($uid === 0) {
            throw new RuntimeException('Run the manager worker as an unprivileged deployment user.');
        }
        // Root inside a rootless user namespace maps to the unprivileged daemon
        // owner on the host, allowing access to that owner's private staging files.
        if ($this->rootless) {
            $uid = $gid = 0;
        }
        // Nested mounts cannot create their destinations after the containing
        // source mount becomes read-only. Prepare only empty, approved points.
        foreach (array_merge(['storage', 'bootstrap/cache'], $building ? ['node_modules'] : ['vendor', 'konnect-addon-manager']) as $point) {
            Files::directory($stage . '/' . $point);
        }
        $command = ['docker', 'run', '--name', 'konnect-stage-' . bin2hex(random_bytes(10)), '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '128', '--memory', $memory, '--cpus', $cpus, '--user', $uid . ':' . $gid, '--workdir', '/work', '--tmpfs', '/tmp:rw,noexec,nosuid,size=128m,uid=' . $uid . ',gid=' . $gid, '--tmpfs', '/work/storage:rw,nosuid,size=64m,uid=' . $uid . ',gid=' . $gid, '--tmpfs', '/work/bootstrap/cache:rw,noexec,nosuid,size=16m,uid=' . $uid . ',gid=' . $gid, '--mount', 'type=bind,src=' . $stage . ',dst=/work,readonly', '--mount', 'type=bind,src=' . $job . ',dst=/job,readonly', '--mount', 'type=bind,src=' . __DIR__ . ',dst=/runner,readonly', '--env', 'APP_ENV=testing', '--env', 'APP_DEBUG=false', '--env', 'APP_ENVIRONMENT_ONLY=true', '--env', 'APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', '--env', 'DB_CONNECTION=sqlite', '--env', 'DB_DATABASE=/tmp/validation.sqlite', '--env', 'CACHE_STORE=array', '--env', 'CACHE_DRIVER=array', '--env', 'SESSION_DRIVER=array', '--env', 'QUEUE_CONNECTION=sync', '--env', 'LOG_CHANNEL=stderr'];
        if (!$building) {
            $vendor = $this->containedDirectory($this->panelRoot . '/vendor', $this->panelRoot);
            $manager = realpath(dirname(__DIR__, 2));
            $command = array_merge($command, ['--mount', 'type=bind,src=' . $vendor . ',dst=/work/vendor,readonly', '--mount', 'type=bind,src=' . $manager . ',dst=/work/konnect-addon-manager,readonly', $image]);
        }
        return $command;
    }

    private function image(string $key): string
    {
        $image = $this->config[$key] ?? '';
        if (!is_string($image) || !preg_match('/^(?:sha256:[0-9a-f]{64}|[A-Za-z0-9][A-Za-z0-9._\/:\-]*@sha256:[0-9a-f]{64})$/D', $image)) {
            throw new RuntimeException('Configure ' . $key . ' with a locally available immutable Docker image ID or digest.');
        }
        $this->process(['docker', 'image', 'inspect', '--format', '{{.Id}}', $image], 15);
        return $image;
    }

    private function security(): void
    {
        if ($this->rootless !== null) {
            return;
        }
        $result = $this->process(['docker', 'info', '--format', '{"security":{{json .SecurityOptions}},"memory":{{json .MemoryLimit}},"pids":{{json .PidsLimit}},"cpuQuota":{{json .CPUCfsQuota}},"cpuPeriod":{{json .CPUCfsPeriod}}}'], 15);
        $info = json_decode(trim($result['stdout']), true, 512, JSON_THROW_ON_ERROR);
        $options = $info['security'] ?? [];
        if (array_filter(['memory', 'pids', 'cpuQuota', 'cpuPeriod'], static fn (string $key): bool => ($info[$key] ?? false) !== true) || !is_array($options) || !array_filter($options, static fn (mixed $option): bool => is_string($option) && preg_match('/^name=seccomp,profile=(?:builtin|default)$/D', $option))) {
            throw new RuntimeException('The Docker daemon must enforce memory, CPU, process limits, and seccomp. Configure delegated cgroups for the rootless worker.');
        }
        $this->rootless = is_array($options) && count(array_filter($options, static fn (mixed $option): bool => is_string($option) && str_contains($option, 'rootless'))) > 0;
        if (!$this->rootless && ($this->config['allowRootfulDaemon'] ?? false) !== true) {
            $this->rootless = null;
            throw new RuntimeException('A rootless Docker daemon is required. A rootful Docker socket grants host-level privileges and must never be granted to the panel web account.');
        }
        if ($this->rootless && fileowner(substr($this->dockerHost(), strlen('unix://'))) !== posix_geteuid()) {
            $this->rootless = null;
            throw new RuntimeException('The rootless Docker socket must belong to the deployment worker account.');
        }
    }

    private function stage(string $path): string
    {
        $stage = $this->containedDirectory($path, $this->stateRoot);
        foreach (['.env', '.git', 'vendor', 'node_modules', 'konnect-addon-manager'] as $name) {
            if (file_exists($stage . '/' . $name) || is_link($stage . '/' . $name)) {
                throw new RuntimeException('Staging contains a protected path: ' . $name);
            }
        }
        foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($stage, \FilesystemIterator::SKIP_DOTS)) as $file) {
            if ($file->isLink()) {
                throw new RuntimeException('Staging must not contain symlinks.');
            }
            if ($file->isFile() && (preg_match('/^\.env(?:\.|$)/i', $file->getBasename()) || preg_match('/\.(?:pem|key|p12|pfx)$/i', $file->getBasename()))) {
                throw new RuntimeException('Staging must not contain environment credentials or private-key files.');
            }
        }
        return $stage;
    }

    private function containedDirectory(string $path, string $parent): string
    {
        $real = realpath($path);
        $root = realpath($parent);
        if (!$real || !$root || !is_dir($real) || is_link($path) || !str_starts_with($real, rtrim($root, '/') . '/')) {
            throw new RuntimeException('Required directory is missing or outside its allowed root: ' . basename($path));
        }
        return $real;
    }

    private function job(array $manifests, array $operation): string
    {
        // Hashes come from manager-owned immutable state, never a package. The
        // composer verifies all baseline bytes before copying them into staging.
        $baseline = Files::json($this->stateRoot . '/registry.json')['baselineInventory'] ?? null;
        if (!is_array($baseline)) {
            throw new RuntimeException('The verified baseline inventory is unavailable.');
        }
        $contents = json_encode(['manifests' => $manifests, 'baselineHashes' => $baseline, 'operation' => ['id' => $operation['id'] ?? null]], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $directory = rtrim($this->stateRoot, '/') . '/runner-jobs/' . bin2hex(random_bytes(12));
        if (!mkdir($directory, 0700, true) && !is_dir($directory)) {
            throw new RuntimeException('Cannot create isolated runner job.');
        }
        if (file_put_contents($directory . '/input.json', $contents) === false) {
            $this->removeJob($directory);
            throw new RuntimeException('Cannot write isolated runner input.');
        }
        chmod($directory . '/input.json', 0600);
        return $directory;
    }

    private function removeJob(string $directory): void
    {
        $this->removeTree($directory);
    }

    private function receiveAssets(string $archive, string $stage): void
    {
        $handle = fopen($archive, 'rb');
        if ($handle === false) {
            throw new RuntimeException('Isolated build output is missing.');
        }
        $generated = dirname($archive) . '/generated';
        Files::directory($generated);
        $read = static function (int $length) use ($handle): string {
            $bytes = '';
            while (strlen($bytes) < $length) {
                $chunk = fread($handle, $length - strlen($bytes));
                if ($chunk === false || $chunk === '') {
                    throw new RuntimeException('Truncated isolated asset output.');
                }
                $bytes .= $chunk;
            }
            return $bytes;
        };
        $seen = [];
        $directories = [];
        $total = 0;
        try {
            if ($read(10) !== "KAMASSET1\n") {
                throw new RuntimeException('Invalid isolated asset protocol.');
            }
            while (true) {
                $header = unpack('nlength/Nsize', $read(6));
                if ($header['length'] === 0 && $header['size'] === 0) {
                    break;
                }
                if ($header['length'] < 1 || $header['length'] > 512 || $header['size'] > 64 * 1024 * 1024 || count($seen) >= 4096 || ($total += $header['size']) > 128 * 1024 * 1024) {
                    throw new RuntimeException('Generated assets exceed the bounded output limits.');
                }
                $relative = $read($header['length']);
                Paths::assertTarget('public/assets/' . $relative);
                $folded = strtolower($relative);
                if (isset($seen[$folded]) || isset($directories[$folded])) {
                    throw new RuntimeException('Generated asset paths overlap.');
                }
                for ($parent = dirname($relative); $parent !== '.'; $parent = dirname($parent)) {
                    $key = strtolower($parent);
                    if (isset($seen[$key]) || (isset($directories[$key]) && $directories[$key] !== $parent)) {
                        throw new RuntimeException('Generated asset parent paths overlap.');
                    }
                    $directories[$key] = $parent;
                }
                $seen[$folded] = true;
                $path = Paths::destination($generated, $relative);
                Files::directory(dirname($path));
                $output = fopen($path, 'xb');
                if ($output === false) {
                    throw new RuntimeException('Cannot receive generated assets.');
                }
                try {
                    $remaining = $header['size'];
                    while ($remaining > 0) {
                        $chunk = $read(min(65536, $remaining));
                        $offset = 0;
                        while ($offset < strlen($chunk)) {
                            $written = fwrite($output, substr($chunk, $offset));
                            if ($written === false || $written === 0) {
                                throw new RuntimeException('Cannot save generated assets.');
                            }
                            $offset += $written;
                        }
                        $remaining -= strlen($chunk);
                    }
                    fflush($output);
                    chmod($path, 0644);
                } finally {
                    fclose($output);
                }
            }
            if (fread($handle, 1) !== '' || !is_file($generated . '/manifest.json')) {
                throw new RuntimeException('Generated asset manifest or stream termination is invalid.');
            }
            $manifest = json_decode(Files::read($generated . '/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($manifest) || !isset($manifest['main.js'])) {
                throw new RuntimeException('Generated assets are missing the required main.js entry.');
            }
            foreach ($manifest as $name => $asset) {
                if (!is_array($asset) || array_diff(array_keys($asset), ['src', 'integrity']) !== [] || !is_string($asset['integrity'] ?? null) || !preg_match('/^sha384-[A-Za-z0-9+\/]{64}$/D', $asset['integrity'])) {
                    throw new RuntimeException('Generated assets contain an invalid integrity mapping.');
                }
                $integrity = $asset['integrity'];
                $asset = $asset['src'] ?? null;
                if (!is_string($name) || !is_string($asset) || !str_starts_with($asset, '/assets/')) {
                    throw new RuntimeException('Unsupported generated asset manifest mapping.');
                }
                $relative = substr($asset, strlen('/assets/'));
                Paths::assertTarget('public/assets/' . $relative);
                $path = Paths::destination($generated, $relative);
                if (!is_file($path) || filesize($path) === 0 || ($name === 'main.js' && !str_ends_with($relative, '.js'))) {
                    throw new RuntimeException('Generated asset manifest references a missing or invalid asset.');
                }
                if (!hash_equals($integrity, 'sha384-' . base64_encode(hash_file('sha384', $path, true)))) {
                    throw new RuntimeException('Generated asset integrity does not match its file.');
                }
            }
        } finally {
            fclose($handle);
        }
        $inventory = Files::inventory($generated);
        $this->removeTree($stage . '/public/assets');
        Files::copyInventory($generated, $stage . '/public/assets', $inventory);
    }

    private function removeTree(string $path): void
    {
        if (is_link($path) || is_file($path)) {
            @unlink($path);
        } elseif (is_dir($path)) {
            foreach (scandir($path) ?: [] as $entry) {
                if ($entry !== '.' && $entry !== '..') {
                    $this->removeTree($path . '/' . $entry);
                }
            }
            @rmdir($path);
        }
    }

    private function removeMountPoints(string $stage): void
    {
        // Docker can create empty bind-mount destinations inside staging.
        // Remove only empty destinations before another validation pass.
        foreach (['vendor', 'node_modules', 'konnect-addon-manager'] as $name) {
            $path = $stage . '/' . $name;
            if (is_dir($path) && !is_link($path)) {
                @rmdir($path);
            }
        }
    }

    private function dockerHost(): string
    {
        $uid = function_exists('posix_geteuid') ? posix_geteuid() : 1000;
        $default = file_exists('/run/user/' . $uid . '/docker.sock') ? 'unix:///run/user/' . $uid . '/docker.sock' : 'unix:///var/run/docker.sock';
        $host = $this->config['dockerHost'] ?? $default;
        if (!is_string($host) || !preg_match('#^unix://(/(?:var/run|run/user/[0-9]+)/docker\.sock)$#D', $host, $match)) {
            throw new RuntimeException('Runner dockerHost must identify a local Unix Docker socket. Remote or unauthenticated daemon endpoints are forbidden.');
        }
        if (is_link($match[1])) {
            throw new RuntimeException('The Docker socket path must not be a symlink.');
        }
        return $host;
    }

    private function timeout(): int
    {
        return max(30, min(1800, (int) ($this->config['timeout'] ?? 300)));
    }

    private function process(array $arguments, int $timeout, ?string $stdoutFile = null, int $maximumBytes = 2097152): array
    {
        $containerName = null;
        if (($arguments[0] ?? null) === 'docker' && ($arguments[1] ?? null) === 'run') {
            $nameAt = array_search('--name', $arguments, true);
            $containerName = $nameAt === false ? null : ($arguments[$nameAt + 1] ?? null);
        }
        if (($arguments[0] ?? null) === 'docker') {
            array_splice($arguments, 1, 0, ['--host', $this->dockerHost()]);
        }
        $pipes = [];
        $capture = $stdoutFile === null ? null : fopen($stdoutFile, 'xb');
        if ($stdoutFile !== null && $capture === false) {
            throw new RuntimeException('Cannot create private isolated output receipt.');
        }
        if (is_resource($capture)) {
            chmod($stdoutFile, 0600);
        }
        $process = proc_open($arguments, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, ['PATH' => getenv('PATH') ?: '/usr/local/bin:/usr/bin:/bin']);
        if (!is_resource($process)) {
            if (is_resource($capture)) {
                fclose($capture);
            }
            throw new RuntimeException('Cannot start isolated runner process.');
        }
        fclose($pipes[0]);
        stream_set_blocking($pipes[1], false);
        stream_set_blocking($pipes[2], false);
        $stdout = $stderr = '';
        $deadline = microtime(true) + $timeout;
        $exit = -1;
        $received = 0;
        $consume = static function (string $chunk) use (&$stdout, &$received, $capture, $maximumBytes): void {
            $received += strlen($chunk);
            if ($received > $maximumBytes) {
                throw new RuntimeException('Isolated runner exceeded its output limit.');
            }
            if (is_resource($capture)) {
                $offset = 0;
                while ($offset < strlen($chunk)) {
                    $written = fwrite($capture, substr($chunk, $offset));
                    if ($written === false || $written === 0) {
                        throw new RuntimeException('Cannot save isolated output receipt.');
                    }
                    $offset += $written;
                }
            } else {
                $stdout .= $chunk;
            }
        };
        try {
            do {
                $consume(stream_get_contents($pipes[1], 65536));
                $stderr .= stream_get_contents($pipes[2], 65536);
                if (strlen($stderr) > 2 * 1024 * 1024) {
                    throw new RuntimeException('Isolated runner exceeded its output limit.');
                }
                $status = proc_get_status($process);
                if (!$status['running']) {
                    $exit = $status['exitcode'];
                    break;
                }
                if (microtime(true) > $deadline) {
                    throw new RuntimeException('Isolated validation/build timed out.');
                }
                usleep(20000);
            } while (true);
            do {
                $chunk = stream_get_contents($pipes[1], 65536);
                $consume($chunk);
            } while ($chunk !== '');
            $stderr .= stream_get_contents($pipes[2], 65536);
            if (strlen($stderr) > 2 * 1024 * 1024) {
                throw new RuntimeException('Isolated runner exceeded its output limit.');
            }
        } finally {
            // Removing the container precedes waiting for its CLI. Container code
            // may ignore SIGTERM, so waiting for docker run first can deadlock.
            if (is_string($containerName) && preg_match('/^konnect-stage-[0-9a-f]{20}$/D', $containerName)) {
                try {
                    $this->process(['docker', 'rm', '--force', $containerName], 15);
                } catch (Throwable) {
                    // --rm normally removed the completed container already.
                }
            }
            if (($status['running'] ?? false) === true) {
                proc_terminate($process);
                $cleanupDeadline = microtime(true) + 1;
                do {
                    $status = proc_get_status($process);
                    if (!$status['running']) {
                        break;
                    }
                    usleep(20000);
                } while (microtime(true) < $cleanupDeadline);
                if ($status['running']) {
                    proc_terminate($process, 9);
                }
            }
            fclose($pipes[1]);
            fclose($pipes[2]);
            $closed = proc_close($process);
            if (is_resource($capture)) {
                fflush($capture);
                fclose($capture);
            }
            if ($exit === -1) {
                $exit = $closed;
            }
        }
        if ($exit !== 0) {
            throw new RuntimeException('Isolated runner failed: ' . substr(trim($stderr ?: $stdout), -6000));
        }
        return ['stdout' => $stdout, 'stderr' => $stderr];
    }
}
