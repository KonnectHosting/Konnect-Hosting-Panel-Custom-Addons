<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use AddonManager\Laravel\{ExtensionRegistry,AddonJob};
use Closure;
use Illuminate\Contracts\Bus\Dispatcher;
use Pterodactyl\Models\{Server,User};
use RuntimeException;
use Symfony\Component\Process\Process;

class BackdoorScanner
{
    public const VERSION = '1.4.0';
    public const RULES = '2026.11.07.1';
    private Closure $enqueue;

    public function __construct(private State $state, private ScannerSource $source, private Access $access, ?Closure $enqueue = null)
    {
        $this->enqueue = $enqueue ?? static function (array $payload): mixed {
            $manifest = app(ExtensionRegistry::class)->guard('gmod.toolkit', self::VERSION, 'system');
            foreach ($manifest['extensions']['jobs'] ?? [] as $job) {
                if ($job['id'] === 'scanner-step' && $job['permission'] === 'system') {
                    return app(Dispatcher::class)->dispatch(new AddonJob('gmod.toolkit', self::VERSION, 'scanner-step', $payload));
                }
            }
            throw new RuntimeException('Scanner job registration is unavailable.');
        };
    }

    private function key(string $uuid): string { return 'scanner-server-' . $uuid; }
    private function dispatch(string $uuid, array $job): void
    {
        $payload = ['uuid' => $uuid, 'server' => $job['server'], 'actor' => $job['actor'], 'job' => $job['id'], 'sequence' => $job['sequence']];
        try { ($this->enqueue)($payload); }
        catch (\Throwable $error) {
            $this->state->locked($this->key($uuid), function () use ($uuid, $job) {
                $current = $this->state->read($this->key($uuid));
                if (($current['id'] ?? '') === $job['id'] && $current['sequence'] === $job['sequence']) {
                    $current['status'] = 'failed'; $current['message'] = 'The Panel queue could not accept the scan. Ask your host to check the queue, then retry.';
                    $this->state->write($this->key($uuid), $current);
                }
            });
            throw new RuntimeException('The Panel queue could not accept the scan. Retry after the queue is available.', 0, $error);
        }
    }

    private function issue(array &$job, string $path, string $reason): void
    {
        ++$job['uninspected'];
        if (count($job['issues']) < 200) { $job['issues'][] = ['file' => $path, 'reason' => $reason]; }
    }

    public function start(Server $server, int $actor): array
    {
        $this->access->checkUser(User::find($actor), $server); $server->validateCurrentState();
        if (in_array(config('queue.default'), ['sync', 'null'], true)) { throw new RuntimeException('The scanner needs the Panel\'s existing asynchronous queue worker.'); }
        if (!is_executable('/usr/bin/python3')) { throw new RuntimeException('The Panel Python 3 runtime is unavailable.'); }
        $job = $this->state->locked($this->key($server->uuid), function () use ($server, $actor) {
            $old = $this->state->read($this->key($server->uuid));
            abort_if(($old['status'] ?? '') === 'running', 409, 'A scan is already running for this server.');
            if (isset($old['snapshot'])) { $this->state->removeDirectory($old['snapshot']); }
            $id = bin2hex(random_bytes(32));
            $job = ['id' => $id, 'server' => $server->id, 'actor' => $actor, 'rulesVersion' => self::RULES,
                'status' => 'running', 'phase' => 'discover', 'started' => gmdate('c'), 'finished' => null,
                'sequence' => 0, 'attempts' => 0, 'updated' => time(), 'progressed' => time(), 'expires' => time() + 7200,
                'dirs' => ['/'], 'entries' => [], 'cursor' => 0, 'visited' => 0, 'discoveredDirectories' => 1,
                'filesScanned' => 0, 'scripts' => 0, 'archives' => 0, 'bytes' => 0, 'plannedBytes' => 0,
                'uninspected' => 0, 'issues' => [], 'findings' => [], 'findingCount' => 0, 'truncated' => false,
                'message' => '', 'current' => '/', 'snapshot' => 'scanner-input-' . $server->uuid . '-' . $id];
            $this->state->directory($job['snapshot']);
            $this->state->write($this->key($server->uuid), $job);
            return $job;
        });
        $this->dispatch($server->uuid, $job);
        return ['status' => 'running'];
    }

    public function cancel(Server $server): array
    {
        return $this->state->locked($this->key($server->uuid), function () use ($server) {
            $job = $this->state->read($this->key($server->uuid));
            if (($job['status'] ?? '') === 'running') {
                $job['status'] = 'cancelled'; $job['finished'] = gmdate('c'); $job['message'] = 'Scan cancelled. Results cover only the files already inspected.';
                $this->state->write($this->key($server->uuid), $job);
                $this->state->removeDirectory($job['snapshot']);
            }
            return ['status' => $job['status'] ?? 'idle'];
        });
    }

    public function info(Server $server): array
    {
        $this->recover($server->uuid);
        $job = $this->state->read($this->key($server->uuid));
        if (!$job) { return ['scan' => null, 'rulesVersion' => self::RULES]; }
        $result = array_intersect_key($job, array_flip(['id','status','phase','started','finished','current','visited','filesScanned','scripts','archives','bytes',
            'uninspected','issues','findings','findingCount','truncated','message','rulesVersion']));
        $result['completed'] = $job['cursor']; $result['total'] = count($job['entries']); $result['pendingDirectories'] = count($job['dirs']);
        $result['waiting'] = $job['status'] === 'running' && $job['progressed'] < time() - 90;
        $result['partial'] = $job['status'] !== 'complete' || $job['uninspected'] > 0 || $job['truncated'];
        return ['scan' => $result, 'rulesVersion' => self::RULES];
    }

    public function handle(array $payload): void
    {
        $server = Server::find($payload['server'] ?? 0); $actor = User::find($payload['actor'] ?? 0);
        if (!$server || !$actor || $server->uuid !== ($payload['uuid'] ?? null)) { $this->stop($payload, 'The server or requesting user is no longer available.'); return; }
        $this->step($server, $actor, $payload);
    }

    public function step(Server $server, User $actor, array $payload): void
    {
        $next = null;
        $this->state->locked($this->key($server->uuid), function () use ($server, $actor, $payload, &$next) {
            $job = $this->state->read($this->key($server->uuid));
            if (($job['id'] ?? null) !== ($payload['job'] ?? null) || ($job['sequence'] ?? null) !== ($payload['sequence'] ?? null) || ($job['status'] ?? '') !== 'running') { return; }
            try {
                if ($job['actor'] !== $actor->id || $job['server'] !== $server->id) { throw new RuntimeException('Scan actor or server changed.'); }
                $this->access->checkUser($actor, $server); $server->validateCurrentState();
                if (++$job['attempts'] > 3 || $job['expires'] < time()) { throw new RuntimeException('Scan expired or exceeded its retry limit. Start a new scan.'); }
                $job['updated'] = time(); $this->state->write($this->key($server->uuid), $job);
                if ($job['phase'] === 'discover') { $this->discover($server, $job); }
                else { $this->inspect($server, $job); }
                ++$job['sequence']; $job['attempts'] = 0; $job['updated'] = time(); $job['progressed'] = time();
                if ($job['status'] === 'running' && $job['phase'] === 'inspect' && $job['cursor'] === count($job['entries'])) {
                    $job['status'] = 'complete'; $job['finished'] = gmdate('c');
                    $job['message'] = 'Scan finished. Findings need review; no static scanner can prove that a server is safe.';
                    $this->state->removeDirectory($job['snapshot']);
                }
                if ($job['status'] === 'running') { $next = $job; }
            } catch (\Throwable $error) {
                $job['status'] = 'failed'; $job['finished'] = gmdate('c');
                $job['message'] = $error instanceof RuntimeException && !$error instanceof \GuzzleHttp\Exception\GuzzleException
                    ? substr($error->getMessage(), 0, 300) : 'Scan stopped. Check the existing Panel/Wings connection and retry.';
                $this->state->removeDirectory($job['snapshot']);
            }
            $this->state->write($this->key($server->uuid), $job);
        });
        if ($next) { $this->dispatch($server->uuid, $next); }
    }

    private function discover(Server $server, array &$job): void
    {
        $directory = array_shift($job['dirs']); $job['current'] = $directory;
        try { $rows = $this->source->listing($server, $directory); }
        catch (\Throwable) { $this->issue($job, $directory, 'Directory could not be listed safely through Wings.'); $rows = []; }
        foreach ($rows as $row) {
            if (++$job['visited'] > 100000) { throw new RuntimeException('Scan reached 100,000 directory entries. Results are incomplete.'); }
            $name = (string) ($row['name'] ?? ''); $path = rtrim($directory, '/') . '/' . $name;
            if (!ScannerSource::path($path) || str_contains($name, '/')) { $this->issue($job, $directory, 'An entry has an unsupported path name.'); continue; }
            if (AssetPolicy::ordinary($row, true)) {
                // Ignore platform/runtime trees, but inspect all server-installed
                // Lua/addon trees, Workshop content and custom root folders.
                if ($directory === '/' && in_array($name, ['bin','bin64','linux64','linux32','platform','sourceengine','hl2','steamcmd','.steam','.git'], true)) { continue; }
                if ($name === '.git') { continue; }
                if (++$job['discoveredDirectories'] > 10000) { throw new RuntimeException('Scan reached 10,000 directories. Results are incomplete.'); }
                $job['dirs'][] = $path;
                continue;
            }
            if (!AssetPolicy::ordinary($row)) { $this->issue($job, $path, 'Symbolic link or special file was not followed.'); continue; }
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            $archive = $ext === 'gma' || ($ext === 'bin' && (str_contains($path, '/workshop/') || str_contains($path, '/cache/') || str_contains($path, '/steam_cache/')));
            $script = in_array($ext, ['lua','txt','cfg','vmt','json','dat','js'], true);
            if (in_array($ext, ['zip','vpk','7z','rar','bz2','gz','xz','dll','so','luac'], true)) {
                $this->issue($job, $path, 'Native binary, bytecode or unsupported archive cannot be inspected as Lua.'); continue;
            }
            if (!$archive && !$script) { continue; }
            $size = $row['size'] ?? -1;
            if (!is_int($size) || $size < 0 || $size > ($archive ? 1073741824 : 2097152)) {
                $this->issue($job, $path, $archive ? 'Archive exceeds 1 GiB or has invalid metadata.' : 'File exceeds 2 MiB or has invalid metadata.'); continue;
            }
            if (count($job['entries']) >= 20000 || $job['plannedBytes'] + $size > 4294967296) { throw new RuntimeException('Scan reached its 20,000-file or 4 GiB transfer limit. Results are incomplete.'); }
            $job['entries'][] = ['file' => $path, 'bytes' => $size, 'modified' => $row['modified'] ?? null, 'kind' => $archive ? 'archive' : 'file'];
            $job['plannedBytes'] += $size;
        }
        if (!$job['dirs']) { $job['phase'] = 'inspect'; }
    }

    private function inspect(Server $server, array &$job): void
    {
        if (!isset($job['entries'][$job['cursor']])) { return; }
        $entry = $job['entries'][$job['cursor']]; $job['current'] = $entry['file'];
        $path = $this->state->object($job['snapshot'], hash('sha256', 'input'));
        if (is_file($path)) { unlink($path); }
        try {
            $reserve = $entry['kind'] === 'archive' ? 2147483648 : $entry['bytes'];
            if (disk_free_space(dirname($path)) < $reserve + 1073741824) { throw new RuntimeException('Insufficient Panel disk space; the scanner preserves 1 GiB free.'); }
            $this->source->copy($server, $entry['file'], $entry, $path);
            $process = new Process(['/usr/bin/python3', '-I', __DIR__ . '/scan.py', $path, $entry['kind']]);
            $process->setTimeout(24); $process->run();
            if (!$process->isSuccessful() || strlen($process->getOutput()) > 262144) { throw new RuntimeException('Static analysis exceeded its resource limit or failed.'); }
            $result = json_decode($process->getOutput(), true, 20, JSON_THROW_ON_ERROR);
            if (($result['rulesVersion'] ?? '') !== self::RULES) { throw new RuntimeException('Scanner rules version mismatch.'); }
            ++$job['filesScanned']; $job['scripts'] += $result['scripts']; $job['bytes'] += $entry['bytes'];
            if ($entry['kind'] === 'archive') { ++$job['archives']; }
            foreach ($result['issues'] as $issue) { $this->issue($job, $entry['file'] . ($issue['member'] ? ' :: ' . $issue['member'] : ''), $issue['reason']); }
            foreach ($result['findings'] as $finding) {
                ++$job['findingCount'];
                if (count($job['findings']) < 500) { $job['findings'][] = $finding + ['file' => $entry['file']]; }
                else {
                    $job['truncated'] = true;
                    $priority = ['critical' => 0, 'high' => 1, 'medium' => 2, 'low' => 3];
                    $worst = 0;
                    foreach ($job['findings'] as $index => $stored) {
                        if ($priority[$stored['severity']] > $priority[$job['findings'][$worst]['severity']]) { $worst = $index; }
                    }
                    if ($priority[$finding['severity']] < $priority[$job['findings'][$worst]['severity']]) { $job['findings'][$worst] = $finding + ['file' => $entry['file']]; }
                }
            }
            $job['truncated'] = $job['truncated'] || $result['truncated'];
        } catch (\Throwable $error) {
            $message = $error instanceof RuntimeException && !$error instanceof \GuzzleHttp\Exception\GuzzleException
                ? substr($error->getMessage(), 0, 240) : 'File could not be read or analyzed safely through Wings.';
            $this->issue($job, $entry['file'], $message);
        } finally { if (is_file($path)) { unlink($path); } }
        ++$job['cursor'];
    }

    private function stop(array $payload, string $message): void
    {
        if (!preg_match('/^[a-f0-9-]{36}$/D', (string) ($payload['uuid'] ?? ''))) { return; }
        $this->state->locked($this->key($payload['uuid']), function () use ($payload, $message) {
            $job = $this->state->read($this->key($payload['uuid']));
            if (($job['id'] ?? null) !== ($payload['job'] ?? null) || ($job['sequence'] ?? null) !== ($payload['sequence'] ?? null) || ($job['status'] ?? '') !== 'running') { return; }
            $job['status'] = 'failed'; $job['message'] = $message; $job['finished'] = gmdate('c');
            $this->state->write($this->key($payload['uuid']), $job);
            $this->state->removeDirectory($job['snapshot']);
        });
    }

    private function recover(string $uuid): void
    {
        $job = $this->state->read($this->key($uuid));
        if (($job['status'] ?? '') !== 'running') { return; }
        if ($job['expires'] < time()) { $this->stop(['uuid' => $uuid, 'job' => $job['id'], 'sequence' => $job['sequence']], 'Scan expired. Results are incomplete; start another scan.'); return; }
        if ($job['updated'] >= time() - 90) { return; }
        $next = $this->state->locked($this->key($uuid), function () use ($uuid) {
            $job = $this->state->read($this->key($uuid));
            if (($job['status'] ?? '') !== 'running' || $job['updated'] >= time() - 90) { return null; }
            $job['updated'] = time(); $this->state->write($this->key($uuid), $job);
            return $job;
        });
        if ($next) { $this->dispatch($uuid, $next); }
    }
}
