<?php
declare(strict_types=1);

namespace Konnect\AddonManager\Tests;

use Konnect\AddonManager\Lifecycle\Manager;
use RuntimeException;
use Throwable;

/** Dependency-free assertions: a failed assertion always reaches the runner's exit code. */
final class Suite
{
    private array $tests = [];

    public function test(string $group, string $name, callable $test): void
    {
        $this->tests[] = compact('group', 'name', 'test');
    }

    public function run(array $arguments): int
    {
        $filter = '';
        $group = '';
        $json = null;
        foreach ($arguments as $argument) {
            if (str_starts_with($argument, '--filter=')) $filter = substr($argument, 9);
            elseif (str_starts_with($argument, '--group=')) $group = substr($argument, 8);
            elseif (str_starts_with($argument, '--json=')) $json = substr($argument, 7);
            else throw new RuntimeException('Unknown test argument: ' . $argument);
        }
        $results = [];
        $started = microtime(true);
        foreach ($this->tests as $test) {
            if ($group !== '' && $test['group'] !== $group) continue;
            if ($filter !== '' && !str_contains($test['name'], $filter)) continue;
            $label = $test['group'] . ': ' . $test['name'];
            $time = microtime(true);
            try {
                ($test['test'])();
                $results[] = ['name' => $label, 'status' => 'passed', 'seconds' => microtime(true) - $time];
                fwrite(STDOUT, 'PASS ' . $label . PHP_EOL);
            } catch (Throwable $error) {
                $results[] = ['name' => $label, 'status' => 'failed', 'message' => $error->getMessage(), 'seconds' => microtime(true) - $time];
                fwrite(STDERR, 'FAIL ' . $label . ': ' . $error->getMessage() . PHP_EOL . $error->getTraceAsString() . PHP_EOL);
            }
        }
        $failed = count(array_filter($results, static fn (array $result): bool => $result['status'] === 'failed'));
        $report = ['executed' => count($results), 'passed' => count($results) - $failed, 'failed' => $failed, 'skipped' => 0, 'seconds' => microtime(true) - $started, 'tests' => $results];
        if ($json !== null && file_put_contents($json, json_encode($report, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL) === false) {
            throw new RuntimeException('Unable to write test report: ' . $json);
        }
        fwrite(STDOUT, sprintf('%d executed, %d passed, %d failed, 0 skipped (%.2fs)%s', $report['executed'], $report['passed'], $failed, $report['seconds'], PHP_EOL));
        return $results === [] ? 2 : ($failed > 0 ? 1 : 0);
    }
}

function check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function same(mixed $expected, mixed $actual, string $message = ''): void
{
    if ($expected !== $actual) throw new RuntimeException(($message === '' ? 'Values differ' : $message) . ': expected ' . var_export($expected, true) . ', received ' . var_export($actual, true));
}

function rejects(callable $action, ?string $messagePattern = null): Throwable
{
    try {
        $action();
    } catch (Throwable $error) {
        if ($messagePattern !== null) check(preg_match($messagePattern, $error->getMessage()) === 1, 'Wrong rejection reason: ' . $error->getMessage());
        return $error;
    }
    throw new RuntimeException('Expected operation to reject, but it succeeded');
}

function write(string $path, string $bytes): void
{
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new RuntimeException('Unable to create fixture directory');
    if (file_put_contents($path, $bytes) === false) throw new RuntimeException('Unable to write fixture ' . $path);
}

function remove(string $path): void
{
    if (is_link($path) || is_file($path)) {
        unlink($path);
    } elseif (is_dir($path)) {
        foreach (new \FilesystemIterator($path) as $entry) remove($entry->getPathname());
        rmdir($path);
    }
}

function temporary(callable $action): mixed
{
    $root = sys_get_temp_dir() . '/konnect-test-' . bin2hex(random_bytes(8));
    mkdir($root, 0700);
    try { return $action($root); }
    finally { remove($root); }
}

function manifest(string $id = 'test.example', string $version = '1.0.0'): array
{
    return [
        'manifestVersion' => 1,
        'id' => $id,
        'name' => 'Fixture ' . $id,
        'version' => $version,
        'compatibility' => ['manager' => '^1.0', 'php' => '^8.2', 'panel' => '^1.15', 'arix' => '^2.1', 'addonPack' => '^2.0'],
        'dependencies' => [],
        'incompatible' => [],
        'files' => [],
        'patches' => [],
        'extensions' => [],
        'build' => ['mode' => 'none'],
    ];
}

/** Payloads are written independently of the implementation's exporter. */
function package(string $root, array $definition, array $payloads = []): string
{
    mkdir($root, 0700, true);
    foreach ($payloads as $path => $bytes) write($root . '/' . $path, $bytes);
    write($root . '/manifest.json', manifestJson($definition) . PHP_EOL);
    return $root;
}

function manifestJson(array $definition): string
{
    // PHP represents both empty JSON arrays and objects as []; preserve the schema's object shape.
    foreach (['extensions', 'compatibility', 'database', 'build'] as $key) {
        if (isset($definition[$key]) && $definition[$key] === []) $definition[$key] = new \stdClass();
    }
    return json_encode($definition, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
}

function fileDeclaration(string $source, string $target, string $bytes): array
{
    return ['source' => $source, 'target' => $target, 'sha256' => hash('sha256', $bytes)];
}

function patchDeclaration(string $id, string $target, string $owner, string $findPath, string $replacementPath, string $find, string $replacement): array
{
    return ['id' => $id, 'target' => $target, 'owner' => $owner, 'find' => $findPath, 'replace' => $replacementPath, 'beforeSha256' => hash('sha256', $find), 'afterSha256' => hash('sha256', $replacement)];
}

/** Build raw ZIP records to test names/attributes that ordinary ZIP writers sanitize. */
function zip(string $path, array $entries): string
{
    $local = '';
    $central = '';
    foreach ($entries as $entry) {
        $name = $entry['name'];
        $bytes = $entry['bytes'] ?? '';
        $method = ($entry['deflate'] ?? false) ? 8 : 0;
        $compressed = $method === 8 ? gzdeflate($bytes, 9) : $bytes;
        $crc = crc32($bytes);
        $size = strlen($bytes);
        $compressedSize = strlen($compressed);
        $attributes = (($entry['mode'] ?? 0100644) << 16);
        $offset = strlen($local);
        $local .= pack('VvvvvvVVVvv', 0x04034b50, 20, 0, $method, 0, 0, $crc, $compressedSize, $size, strlen($name), 0) . $name . $compressed;
        $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 0x0314, 20, 0, $method, 0, 0, $crc, $compressedSize, $size, strlen($name), 0, 0, 0, 0, $attributes, $offset) . $name;
    }
    write($path, $local . $central . pack('VvvvvVVv', 0x06054b50, 0, 0, count($entries), count($entries), strlen($central), strlen($local), 0));
    return $path;
}

function host(): array
{
    return ['manager' => '1.0.0', 'php' => PHP_VERSION, 'panel' => '1.15.1', 'arix' => '2.1.3', 'addonPack' => '2.0.2'];
}

function fixture(string $root, array $config = []): array
{
    $panel = $root . '/panel';
    write($panel . '/resources/views/base.blade.php', "baseline header\nsummary=BASE\nfooter=BASE\n");
    write($panel . '/.env', "TEST_FIXTURE_ONLY=true\n");
    $manager = new Manager($panel, $root . '/state', $config);
    $manager->initialize(host());
    return ['root' => $root, 'panel' => $panel, 'state' => $root . '/state', 'manager' => $manager];
}

function operation(array $fixture, string $action, array $arguments, string $expected = 'succeeded', ?string $requestId = null): array
{
    $queued = $fixture['manager']->enqueue($action, $arguments, 'tests', $requestId);
    check(isset($queued['id']), 'Queued operation has no durable ID');
    $fixture['manager']->workOnce();
    $result = $fixture['manager']->operation($queued['id']);
    same($expected, $result['status'] ?? null, 'Operation ' . $action . ' failed: ' . json_encode($result));
    return $result;
}

function dependencyPackages(string $root): array
{
    $target = 'resources/views/addon-a.blade.php';
    $original = "owned by A\nsummary=BASE\nfooter=BASE\n";
    $a = manifest('test.a');
    $a['files'][] = fileDeclaration('payload/a.blade.php', $target, $original);
    $aRoot = package($root . '/a', $a, ['payload/a.blade.php' => $original]);
    $b = manifest('test.b');
    $b['dependencies'][] = ['id' => 'test.a', 'version' => '^1.0'];
    $b['patches'][] = patchDeclaration('summary', $target, 'addon:test.a', 'patches/find.txt', 'patches/replace.txt', 'summary=BASE', 'summary=B');
    $bRoot = package($root . '/b', $b, ['patches/find.txt' => 'summary=BASE', 'patches/replace.txt' => 'summary=B']);
    $c = manifest('test.c');
    $c['dependencies'][] = ['id' => 'test.a', 'version' => '^1.0'];
    $c['patches'][] = patchDeclaration('footer', $target, 'addon:test.a', 'patches/find.txt', 'patches/replace.txt', 'footer=BASE', 'footer=C');
    $cRoot = package($root . '/c', $c, ['patches/find.txt' => 'footer=BASE', 'patches/replace.txt' => 'footer=C']);
    return ['a' => $aRoot, 'b' => $bRoot, 'c' => $cRoot, 'target' => $target, 'original' => $original];
}

function phpCommand(string $script, array $arguments = []): array
{
    $pipes = [];
    $process = proc_open([PHP_BINARY, $script, ...$arguments], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    check(is_resource($process), 'Unable to launch PHP CLI fixture');
    fclose($pipes[0]);
    $stdout = stream_get_contents($pipes[1]);
    $stderr = stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    return ['exit' => proc_close($process), 'stdout' => $stdout, 'stderr' => $stderr];
}
