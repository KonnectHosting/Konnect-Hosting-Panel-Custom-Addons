<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use AddonManager\Laravel\ExtensionRegistry;
use Closure;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\User;
use RuntimeException;
use Symfony\Component\Process\Process;

class Fastdl
{
    public const VERSION = '1.1.1';
    private Closure $enqueue;

    public function __construct(private State $state, private AssetSource $source, private Access $access, ?Closure $enqueue = null)
    {
        $this->enqueue = $enqueue ?? static fn (array $payload) => app(ExtensionRegistry::class)->dispatchJob('gmod.toolkit', self::VERSION, 'fastdl-step', $payload);
    }

    private function key(string $uuid): string { return 'fastdl-server-' . $uuid; }
    private function url(string $token): string
    {
        return rtrim((string) config('app.url'), '/') . '/fastdl/' . $token . '/';
    }
    private function record(string $uuid): array
    {
        return $this->state->read($this->key($uuid), ['revision' => 0, 'token' => null, 'generation' => null, 'manifest' => []]);
    }
    private function dispatch(string $uuid, array $job): void
    {
        ($this->enqueue)(['uuid' => $uuid, 'job' => $job['id'], 'sequence' => $job['sequence'], 'server' => $job['server'], 'actor' => $job['actor']]);
    }
    private function space(string $snapshot, int $bytes): void
    {
        if (disk_free_space($this->state->directory($snapshot)) < $bytes + 1073741824) {
            throw new RuntimeException('Insufficient Panel disk space; FastDL preserves 1 GiB free for the Panel.');
        }
    }

    public function info(Server $server, int $actor): array
    {
        // Status requests are already authorized by the server controller. Resume
        // only this server's stale work; no application-wide scheduler is needed.
        $this->recover($server->uuid);
        $r = $this->record($server->uuid); $job = $r['job'] ?? null; $preview = null;
        if ($job && $job['status'] === 'preview-ready' && $job['actor'] === $actor && $job['expires'] >= time()) {
            $preview = $this->previewResult($r, $job);
        }
        return ['url' => $r['token'] ? $this->url($r['token']) : null, 'files' => count($r['manifest']),
            'preview' => $preview, 'job' => $job ? ['status' => $job['status'], 'phase' => $job['phase'], 'message' => $job['message'],
                'completed' => $job['cursor'], 'total' => count($job['entries'])] : null];
    }

    private function previewResult(array $r, array $job): array
    {
        $new = $job['manifest']; $old = $r['manifest'];
        return ['preview' => $job['id'], 'files' => count($new), 'bytes' => $job['bytes'], 'skipped' => $job['skipped'],
            'added' => array_values(array_diff(array_keys($new), array_keys($old))),
            'removed' => array_values(array_diff(array_keys($old), array_keys($new))),
            'changed' => array_values(array_filter(array_keys($new), static fn ($path) => isset($old[$path]) && $new[$path]['sha256'] !== $old[$path]['sha256']))];
    }

    public function preview(Server $server, int $actor): array
    {
        if (in_array(config('queue.default'), ['sync', 'null'], true)) { throw new RuntimeException('FastDL requires the Panel\'s existing asynchronous queue worker.'); }
        $job = $this->state->locked($this->key($server->uuid), function () use ($server, $actor) {
            $r = $this->record($server->uuid);
            abort_if(($r['job']['status'] ?? '') === 'running', 409, 'A FastDL operation is already running.');
            if (isset($r['job']['snapshot']) && $r['job']['snapshot'] !== $r['generation']) { $this->state->removeDirectory($r['job']['snapshot']); }
            $id = bin2hex(random_bytes(32));
            $r['job'] = ['id' => $id, 'server' => $server->id, 'actor' => $actor, 'status' => 'running', 'phase' => 'scan',
                'dirs' => [''], 'entries' => [], 'manifest' => [], 'bytes' => 0, 'visited' => 0, 'skipped' => 0, 'cursor' => 0,
                'sequence' => 0, 'attempts' => 0, 'updated' => time(), 'expires' => time() + 3600, 'revision' => $r['revision'],
                'message' => '', 'snapshot' => 'fastdl-snapshot-' . $server->uuid . '-' . $id];
            $this->state->directory($r['job']['snapshot']);
            $this->state->write($this->key($server->uuid), $r);
            return $r['job'];
        });
        $this->dispatch($server->uuid, $job);
        return ['status' => 'running'];
    }

    public function publish(Server $server, int $actor, string $preview): array
    {
        $job = $this->state->locked($this->key($server->uuid), function () use ($server, $actor, $preview) {
            $r = $this->record($server->uuid); $job = $r['job'] ?? [];
            abort_unless(($job['status'] ?? null) === 'preview-ready' && $job['id'] === $preview && $job['actor'] === $actor
                && $job['expires'] >= time() && $job['revision'] === $r['revision'], 409, 'Preview expired, changed, or belongs to another user.');
            if (!is_executable('/usr/bin/python3') || !is_file(__DIR__ . '/compress.py')) { throw new RuntimeException('The Panel\'s Python 3 runtime is unavailable.'); }
            $job['status'] = 'running'; $job['phase'] = 'compress'; $job['cursor'] = 0; $job['updated'] = time(); $job['expires'] = time() + 3600;
            ++$job['sequence']; $job['attempts'] = 0; $r['job'] = $job;
            $this->state->write($this->key($server->uuid), $r);
            return $job;
        });
        $this->dispatch($server->uuid, $job);
        return ['status' => 'running'];
    }

    public function rotate(Server $server, bool $revoke): array
    {
        return $this->state->locked($this->key($server->uuid), function () use ($server, $revoke) {
            $r = $this->record($server->uuid); $old = $r['token'];
            $r['token'] = !$revoke && $r['generation'] ? bin2hex(random_bytes(32)) : null;
            ++$r['revision'];
            if (($r['job']['status'] ?? '') === 'running' || ($r['job']['status'] ?? '') === 'preview-ready') {
                $r['job']['status'] = 'failed'; $r['job']['message'] = 'URL changed; create a new preview.';
                if ($r['job']['snapshot'] !== $r['generation']) { $this->state->removeDirectory($r['job']['snapshot']); }
            }
            if ($r['token']) { $this->state->write('fastdl-token-' . $r['token'], ['uuid' => $server->uuid, 'server' => $server->id]); }
            $this->state->write($this->key($server->uuid), $r);
            if ($old) { $this->state->remove('fastdl-token-' . $old); }
            return ['url' => $r['token'] ? $this->url($r['token']) : null];
        });
    }

    public function handle(array $payload): void
    {
        $server = Server::find($payload['server'] ?? 0); $actor = User::find($payload['actor'] ?? 0);
        if (!$server || !$actor || $server->uuid !== ($payload['uuid'] ?? null)) { $this->fail($payload, 'The server or requesting user is no longer available.'); return; }
        $this->step($server, $actor, $payload);
    }

    public function step(Server $server, User $actor, array $payload): void
    {
        $next = null;
        $this->state->locked($this->key($server->uuid), function () use ($server, $actor, $payload, &$next) {
            $r = $this->record($server->uuid); $job = $r['job'] ?? [];
            if (($job['id'] ?? null) !== ($payload['job'] ?? null) || ($job['sequence'] ?? null) !== ($payload['sequence'] ?? null) || ($job['status'] ?? '') !== 'running') { return; }
            try {
                if ($job['actor'] !== $actor->id || $job['server'] !== $server->id || $job['revision'] !== $r['revision']) { throw new RuntimeException('FastDL operation was replaced.'); }
                $this->access->checkUser($actor, $server, $job['phase'] === 'compress'); $server->validateCurrentState();
                if (++$job['attempts'] > 3 || $job['expires'] < time()) { throw new RuntimeException('FastDL operation expired or exceeded its retry limit. Preview again.'); }
                $job['updated'] = time(); $r['job'] = $job; $this->state->write($this->key($server->uuid), $r);
                if ($job['phase'] === 'scan') { $this->scan($server, $job); }
                elseif ($job['phase'] === 'copy') { $this->copy($server, $job); }
                elseif ($job['phase'] === 'compress') { $this->compress($job); }
                else { throw new RuntimeException('Invalid FastDL phase.'); }
                if ($job['phase'] === 'commit') {
                    // One server record atomically selects the complete approved generation.
                    $old = $r['generation']; $r['generation'] = $job['snapshot']; $r['manifest'] = $job['manifest'];
                    $r['token'] ??= bin2hex(random_bytes(32)); ++$r['revision'];
                    $this->state->write('fastdl-token-' . $r['token'], ['uuid' => $server->uuid, 'server' => $server->id]);
                    $job['status'] = 'complete';
                }
                ++$job['sequence']; $job['attempts'] = 0; $job['updated'] = time(); $r['job'] = $job;
                $this->state->write($this->key($server->uuid), $r);
                if ($job['status'] === 'running') { $next = $job; }
                if (isset($old) && $old && $old !== $r['generation']) { $this->state->removeDirectory($old); }
            } catch (\Throwable $error) {
                $job['status'] = 'failed';
                $job['message'] = $error instanceof RuntimeException && !$error instanceof \GuzzleHttp\Exception\GuzzleException
                    ? substr($error->getMessage(), 0, 300) : 'FastDL operation failed. Check the existing Panel/Wings connection and retry.';
                $r['job'] = $job; $this->state->write($this->key($server->uuid), $r);
                if ($job['snapshot'] !== $r['generation']) { $this->state->removeDirectory($job['snapshot']); }
            }
        });
        if ($next) { $this->dispatch($server->uuid, $next); }
    }

    private function scan(Server $server, array &$job): void
    {
        $directory = array_shift($job['dirs']);
        foreach ($this->source->listing($server, $directory) as $row) {
            if (++$job['visited'] > 20000) { throw new RuntimeException('Asset scan exceeded 20,000 entries.'); }
            $name = (string) ($row['name'] ?? '');
            if (!preg_match('/^[A-Za-z0-9_+-][A-Za-z0-9_+.-]*$/D', $name)) { ++$job['skipped']; continue; }
            $relative = $directory === '' ? $name : $directory . '/' . $name;
            if (AssetPolicy::ordinary($row, true) && strlen($relative) <= 220 && count(explode('/', $relative)) < 15
                && ($directory === '' ? isset(AssetPolicy::TYPES[$name]) : true)) {
                $job['dirs'][] = $relative;
            } elseif (AssetPolicy::ordinary($row) && AssetPolicy::path($relative)) {
                $size = $row['size'] ?? -1;
                if (!is_int($size) || $size < 0 || $size > AssetPolicy::MAX_FILE || $job['bytes'] + $size > AssetPolicy::MAX_TOTAL || count($job['entries']) >= AssetPolicy::MAX_FILES) {
                    throw new RuntimeException('FastDL quota exceeded: 128 MiB/file, 2 GiB/server, 5000 files.');
                }
                $job['entries'][$relative] = ['bytes' => $size, 'modified' => $row['modified'] ?? null]; $job['bytes'] += $size;
            } else { ++$job['skipped']; }
        }
        if (!$job['dirs']) {
            ksort($job['entries']);
            $this->space($job['snapshot'], $job['bytes'] * 2);
            $job['phase'] = 'copy';
        }
    }

    private function copy(Server $server, array &$job): void
    {
        $names = array_keys($job['entries']);
        if (isset($names[$job['cursor']])) {
            $path = $names[$job['cursor']]; $object = hash('sha256', $path);
            $this->space($job['snapshot'], $job['entries'][$path]['bytes']);
            $partial = $this->state->object($job['snapshot'], $object . '.part');
            if (is_file($partial)) { unlink($partial); }
            $info = $this->source->copy($server, $path, $job['entries'][$path], $partial);
            rename($partial, $this->state->object($job['snapshot'], $object));
            $job['manifest'][$path] = $info; ++$job['cursor'];
        }
        if ($job['cursor'] === count($names)) { $job['status'] = 'preview-ready'; $job['expires'] = time() + 900; }
    }

    private function compress(array &$job): void
    {
        $names = array_keys($job['manifest']);
        if (isset($names[$job['cursor']])) {
            $file = $job['manifest'][$names[$job['cursor']]];
            $this->space($job['snapshot'], $file['bytes'] + 1048576);
            $raw = $this->state->object($job['snapshot'], $file['object']);
            if (hash_file('sha256', $raw) !== $file['sha256']) { throw new RuntimeException('Private snapshot changed. Preview again.'); }
            $partial = $this->state->object($job['snapshot'], $file['object'] . '.part');
            if (is_file($partial)) { unlink($partial); }
            $process = new Process(['/usr/bin/python3', '-I', __DIR__ . '/compress.py', $raw, $partial]);
            $process->setTimeout(30); $process->disableOutput(); $process->run();
            if (!$process->isSuccessful()) { throw new RuntimeException('Panel bzip2 compression failed or timed out.'); }
            rename($partial, $this->state->object($job['snapshot'], $file['object'] . '.bz2'));
            ++$job['cursor'];
        }
        if ($job['cursor'] === count($names)) { $job['phase'] = 'commit'; }
    }

    private function fail(array $payload, string $message): void
    {
        if (!preg_match('/^[a-f0-9-]{36}$/D', (string) ($payload['uuid'] ?? ''))) { return; }
        $this->state->locked($this->key($payload['uuid']), function () use ($payload, $message) {
            $r = $this->record($payload['uuid']);
            if (($r['job']['id'] ?? null) !== ($payload['job'] ?? null)) { return; }
            $r['job']['status'] = 'failed'; $r['job']['message'] = $message;
            $this->state->write($this->key($payload['uuid']), $r);
            if ($r['job']['snapshot'] !== $r['generation']) { $this->state->removeDirectory($r['job']['snapshot']); }
        });
    }

    public function recover(string $uuid): void
    {
        $r = $this->record($uuid); $job = $r['job'] ?? null;
        if (!$job) { return; }
        if ($job['status'] === 'preview-ready' && $job['expires'] < time()) {
            $this->fail(['uuid' => $uuid, 'job' => $job['id']], 'Preview expired.');
        } elseif ($job['status'] === 'running' && $job['updated'] < time() - 90) {
            $next = $this->state->locked($this->key($uuid), function () use ($uuid) {
                $r = $this->record($uuid); $job = $r['job'] ?? null;
                if (!$job || $job['status'] !== 'running' || $job['updated'] >= time() - 90) { return null; }
                $r['job']['updated'] = time();
                $this->state->write($this->key($uuid), $r);
                return $r['job'];
            });
            if ($next) { $this->dispatch($uuid, $next); }
        }
    }

    public function download(string $token, string $path): array
    {
        abort_unless(preg_match('/^[a-f0-9]{64}$/D', $token), 404);
        $compressed = str_ends_with($path, '.bz2'); $original = $compressed ? substr($path, 0, -4) : $path;
        abort_unless(AssetPolicy::path($original), 404);
        $index = $this->state->read('fastdl-token-' . $token);
        abort_unless(isset($index['uuid'], $index['server']), 404);
        $server = Server::find($index['server']);
        abort_unless($server && $server->uuid === $index['uuid'] && $this->access->eligible($server), 404);
        try { $server->validateCurrentState(); } catch (\Throwable) { abort(404); }
        $r = $this->record($server->uuid);
        abort_unless($r['token'] === $token && $r['generation'] && isset($r['manifest'][$original]), 404);
        $file = $r['manifest'][$original];
        $local = $this->state->object($r['generation'], $file['object'] . ($compressed ? '.bz2' : ''));
        abort_unless(is_file($local) && !is_link($local), 404);
        return ['path' => $local, 'bytes' => filesize($local)];
    }
}
