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
    public const VERSION = '1.6.0';
    public const RULES = '2026.11.07.3';
    public const TEXT_BUDGET = 536870912;
    public const ARCHIVE_BUDGET = 4294967296;
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

    private function issue(array &$job, string $path, string $reason, bool $blocking = true): void
    {
        ++$job['uninspected'];
        if ($blocking) { ++$job['blockingIssues']; }
        if (count($job['issues']) < 200) { $job['issues'][] = ['file' => $path, 'reason' => $reason, 'blocking' => $blocking]; }
    }

    public function start(Server $server, int $actor, bool $archives = false, bool $verify = false, array $locations = ['/garrysmod/addons']): array
    {
        $this->access->checkUser(User::find($actor), $server); $server->validateCurrentState();
        $locations = ScanScope::selection($locations, $archives);
        abort_unless($this->enabled($server->uuid), 409, 'The scanner is disabled for this server. A server owner or file manager can enable it.');
        $this->recover($server->uuid);
        if (in_array(config('queue.default'), ['sync', 'null'], true)) { throw new RuntimeException('The scanner needs the Panel\'s existing asynchronous queue worker.'); }
        if (!is_executable('/usr/bin/python3')) { throw new RuntimeException('The Panel Python 3 runtime is unavailable.'); }
        $job = $this->state->locked($this->key($server->uuid), function () use ($server, $actor, $archives, $verify, $locations) {
            $old = $this->state->read($this->key($server->uuid));
            abort_if(($old['status'] ?? '') === 'running', 409, 'A scan is already running for this server.');
            if (isset($old['snapshot'])) { $this->state->removeDirectory($old['snapshot']); }
            $id = bin2hex(random_bytes(32));
            $job = ['id' => $id, 'server' => $server->id, 'actor' => $actor, 'rulesVersion' => self::RULES,
                'manual' => true, 'scopeVersion' => ScanScope::VERSION, 'includeArchives' => $archives, 'locations' => $locations,
                'verify' => $verify, 'reused' => 0, 'blockingIssues' => 0,
                'cacheSlots' => max(0, 50000 - count((new State($this->state->directory('scanner-cache-' . $server->uuid)))->keys('file-', 50001))),
                'status' => 'running', 'phase' => 'discover', 'started' => gmdate('c'), 'finished' => null,
                'sequence' => 0, 'attempts' => 0, 'updated' => time(), 'progressed' => time(), 'expires' => time() + 7200,
                'rootsPending' => $locations, 'dirs' => [], 'entries' => [], 'archiveEntries' => [],
                'cursor' => 0, 'total' => 0, 'visited' => 0, 'discoveredDirectories' => 0,
                'filesScanned' => 0, 'scripts' => 0, 'archives' => 0, 'bytes' => 0, 'textBudgetUsed' => 0, 'archiveBudgetUsed' => 0,
                'uninspected' => 0, 'issues' => [], 'findings' => [], 'findingCount' => 0, 'truncated' => false,
                'message' => '', 'current' => $locations[0], 'snapshot' => 'scanner-input-' . $server->uuid . '-' . $id];
            $this->state->directory($job['snapshot']);
            $this->state->write($this->key($server->uuid), $job);

            return $job;
        });
        $this->dispatch($server->uuid, $job);
        return ['status' => 'running', 'id' => $job['id']];
    }

    private function enabled(string $uuid): bool { return $this->state->read('scanner-settings-' . $uuid)['enabled'] ?? true; }

    public function settings(Server $server, bool $enabled): array
    {
        $this->state->write('scanner-settings-' . $server->uuid, ['enabled' => $enabled]);
        if (!$enabled) { $this->cancel($server); }
        return ['enabled' => $enabled, 'message' => $enabled ? 'Manual scanner enabled. Choose files and start a scan when needed.' : 'Scanner disabled. Any current scan is being cancelled.'];
    }

    private function cancelled(string $uuid, array $job): bool
    {
        return !$this->enabled($uuid) || ($this->state->read('scanner-cancel-' . $uuid)['id'] ?? '') === $job['id'];
    }

    private function finishCancellation(array &$job): void
    {
        $job['status'] = 'cancelled'; $job['finished'] = gmdate('c');
        $job['message'] = 'Scan cancelled. Results cover only the files already inspected.';
        $this->state->removeDirectory($job['snapshot']);
    }

    public function cancel(Server $server, ?User $actor = null): array
    {
        $job = $this->state->read($this->key($server->uuid));
        if (($job['status'] ?? '') !== 'running') { return ['status' => $job['status'] ?? 'idle']; }
        abort_unless(!$actor || $actor->id === $job['actor'] || $actor->can('control.stop', $server), 403, 'Only the requesting user or a server operator can cancel this scan.');
        // This marker deliberately uses no worker lock: cancellation must remain
        // available while Wings is streaming or the analysis helper is running.
        $this->state->write('scanner-cancel-' . $server->uuid, ['id' => $job['id']]);
        $this->settleCancellation($server->uuid);
        return ['status' => 'cancelled'];
    }

    private function settleCancellation(string $uuid): void
    {
        try {
            $this->state->locked($this->key($uuid), function () use ($uuid) {
                $job = $this->state->read($this->key($uuid));
                if (($job['status'] ?? '') === 'running' && $this->cancelled($uuid, $job)) {
                    $this->finishCancellation($job); $this->state->write($this->key($uuid), $job);
                }
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $error) { if ($error->getStatusCode() !== 409) { throw $error; } }
    }

    public function info(Server $server): array
    {
        $this->recover($server->uuid);
        $job = $this->state->read($this->key($server->uuid));
        $base = ['enabled' => $this->enabled($server->uuid), 'rulesVersion' => self::RULES, 'locations' => ScanScope::CODE, 'archiveLocations' => ScanScope::ARCHIVES];
        if (!$job) { return ['scan' => null] + $base; }
        $result = array_intersect_key($job, array_flip(['id','status','phase','started','finished','current','visited','filesScanned','scripts','archives','bytes',
            'uninspected','issues','findings','findingCount','truncated','message','rulesVersion','scopeVersion','includeArchives','locations','reused']));
        $result['outdated'] = ($job['rulesVersion'] ?? '') !== self::RULES || ($job['scopeVersion'] ?? '') !== ScanScope::VERSION;
        $result['cancelling'] = $job['status'] === 'running' && $this->cancelled($server->uuid, $job);
        if ($result['cancelling']) { $result['status'] = 'cancelling'; }
        if ($result['outdated']) { $result['findings'] = []; $result['findingCount'] = 0; }
        $result['completed'] = $job['cursor']; $result['total'] = $job['total'] ?? count($job['entries']);
        $result['pendingDirectories'] = count($job['dirs']) + count($job['rootsPending'] ?? []);
        $result['waiting'] = $job['status'] === 'running' && $job['progressed'] < time() - 90;
        $result['partial'] = $job['status'] !== 'complete' || $job['uninspected'] > 0 || $job['truncated'];
        return ['scan' => $result] + $base;
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
                if (($job['manual'] ?? false) !== true || ($job['scopeVersion'] ?? '') !== ScanScope::VERSION || ($job['rulesVersion'] ?? '') !== self::RULES) { throw new RuntimeException('Previous scanner job retired. Choose locations and request a new manual scan.'); }
                $this->source->setCancellation(function () use ($server, $job) { if ($this->cancelled($server->uuid, $job)) { throw new RuntimeException('Scan cancelled.'); } });
                if ($this->cancelled($server->uuid, $job)) { throw new RuntimeException('Scan cancelled.'); }
                $this->access->checkUser($actor, $server); $server->validateCurrentState();
                if (++$job['attempts'] > 3 || $job['expires'] < time()) { throw new RuntimeException('Scan expired or exceeded its retry limit. Start a new scan.'); }
                $job['updated'] = time(); $this->state->write($this->key($server->uuid), $job);
                // Drain each directory's loose code immediately. Packed archives
                // are optional and run after all loose code has been inspected.
                if ($job['entries']) { $job['phase'] = 'inspect'; $this->inspect($server, $job); }
                elseif ($job['dirs']) { $job['phase'] = 'discover'; $this->discover($server, $job); }
                elseif ($job['rootsPending']) { $job['phase'] = 'discover'; $this->root($server, $job); }
                elseif ($job['archiveEntries']) { $job['phase'] = 'archives'; $this->inspect($server, $job, true); }
                if ($this->cancelled($server->uuid, $job)) { throw new RuntimeException('Scan cancelled.'); }
                ++$job['sequence']; $job['attempts'] = 0; $job['updated'] = time(); $job['progressed'] = time();
                if (!$job['entries'] && !$job['dirs'] && !$job['rootsPending'] && !$job['archiveEntries']) {
                    $job['status'] = 'complete'; $job['finished'] = gmdate('c');
                    $job['message'] = 'Scan finished. Findings need review; no static scanner can prove that a server is safe.';
                    $this->state->removeDirectory($job['snapshot']);
                }
                if ($job['status'] === 'running') { $next = $job; }
            } catch (\Throwable $error) {
                $job['status'] = 'failed'; $job['finished'] = gmdate('c');
                $job['message'] = $error instanceof RuntimeException && !$error instanceof \GuzzleHttp\Exception\GuzzleException
                    ? substr($error->getMessage(), 0, 300) : 'Scan stopped. Check the existing Panel/Wings connection and retry.';
                if ($this->cancelled($server->uuid, $job)) { $this->finishCancellation($job); }
                else { $this->state->removeDirectory($job['snapshot']); }
            } finally { $this->source->setCancellation(null); }
            $this->state->write($this->key($server->uuid), $job);
        });
        if ($next) { $this->dispatch($server->uuid, $next); }
    }

    private function root(Server $server, array &$job): void
    {
        $root = array_shift($job['rootsPending']); $job['current'] = $root;
        try {
            if ($this->source->available($server, $root)) { $job['dirs'][] = $root; ++$job['discoveredDirectories']; }
            elseif (ScanScope::directory(dirname($root), $job['includeArchives'])) {
                $rows = array_values(array_filter($this->source->listing($server, dirname($root)), static fn ($row) => ($row['name'] ?? '') === basename($root)));
                if (!$rows) { $this->issue($job, $root, 'Selected file or folder is not present.'); }
                else { $this->candidates($server, $job, dirname($root), $rows); }
            }
        } catch (\Throwable) {
            if ($this->cancelled($server->uuid, $job)) { throw new RuntimeException('Scan cancelled.'); }
            $this->issue($job, $root, 'Scan location could not be checked safely through Wings.');
        }
    }

    private function discover(Server $server, array &$job): void
    {
        $directory = array_shift($job['dirs']); $job['current'] = $directory;
        if (!ScanScope::directory($directory, $job['includeArchives'])) { $this->issue($job, $directory, 'Folder is outside the selected scanner locations.'); return; }
        try { $rows = $this->source->listing($server, $directory); }
        catch (\Throwable) {
            if ($this->cancelled($server->uuid, $job)) { throw new RuntimeException('Scan cancelled.'); }
            $this->issue($job, $directory, 'Directory could not be listed safely through Wings.'); $rows = [];
        }
        $this->candidates($server, $job, $directory, $rows);
    }

    private function candidates(Server $server, array &$job, string $directory, array $rows): void
    {
        foreach ($rows as $row) {
            if ($this->cancelled($server->uuid, $job)) { throw new RuntimeException('Scan cancelled.'); }
            if (++$job['visited'] > 100000) {
                $this->issue($job, $directory, 'Reached the 100,000-entry discovery limit. Files already found will still be inspected.');
                $job['dirs'] = []; $job['rootsPending'] = []; break;
            }
            $name = (string) ($row['name'] ?? ''); $path = rtrim($directory, '/') . '/' . $name;
            if (!ScannerSource::path($path) || str_contains($name, '/')) { $this->issue($job, $directory, 'An entry has an unsupported path name.'); continue; }
            // Out-of-scope asset trees remain excluded even when their directory
            // entry is a symlink; they are not failed code inspections.
            if (in_array($name, ['.git','node_modules'], true) || (!ScanScope::directory($path, $job['includeArchives']) && pathinfo($name, PATHINFO_EXTENSION) === '')) { continue; }
            if (AssetPolicy::ordinary($row, true)) {
                if (!ScanScope::directory($path, $job['includeArchives'])) { continue; }
                if (++$job['discoveredDirectories'] > 10000) { $this->issue($job, $path, 'Directory limit reached; this folder was not traversed.'); continue; }
                $job['dirs'][] = $path;
                continue;
            }
            if (!AssetPolicy::ordinary($row)) { $this->issue($job, $path, 'Symbolic link or special file was not followed.'); continue; }
            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            $archive = $ext === 'gma' || ($ext === 'bin' && (str_contains($path, '/workshop/') || str_contains($path, '/cache/') || str_contains($path, '/steam_cache/')));
            $script = in_array($ext, ['lua','txt','cfg','vmt','json','dat','js'], true);
            if (ScanScope::archiveOnly($directory) && !$archive) { continue; }
            if ($archive && !$job['includeArchives']) { $this->issue($job, $path, 'Packed archive excluded from the loose-code scan. Enable packed addons to inspect it.', false); continue; }
            if (in_array($ext, ['zip','vpk','7z','rar','bz2','gz','xz','dll','so','luac'], true)) {
                $this->issue($job, $path, 'Native binary, bytecode or unsupported archive cannot be inspected as Lua.', $ext === 'luac'); continue;
            }
            if (!$archive && !$script) { continue; }
            $size = $row['size'] ?? -1;
            if (!is_int($size) || $size < 0 || $size > ($archive ? 1073741824 : 2097152)) {
                $this->issue($job, $path, $archive ? 'Archive exceeds 1 GiB or has invalid metadata.' : 'File exceeds 2 MiB or has invalid metadata.'); continue;
            }
            if ($job['total'] >= 50000) { $this->issue($job, $path, 'Candidate limit reached; previously found files are still inspected.'); continue; }
            $entry = ['file' => $path, 'bytes' => $size, 'modified' => $row['modified'] ?? null, 'kind' => $archive ? 'archive' : 'file'];
            if ($archive) { $job['archiveEntries'][] = $entry; }
            else { $job['entries'][] = $entry; }
            ++$job['total'];
        }
    }

    private function inspect(Server $server, array &$job, bool $archive = false): void
    {
        $entry = $archive ? array_shift($job['archiveEntries']) : array_shift($job['entries']); $job['current'] = $entry['file'];
        $path = $this->state->object($job['snapshot'], hash('sha256', 'input'));
        if (is_file($path)) { unlink($path); }
        try {
            if (!ScanScope::file($entry['file'])) { throw new RuntimeException('File is outside the scanner locations.'); }
            $cacheState = new State($this->state->directory('scanner-cache-' . $server->uuid));
            $cacheKey = 'file-' . hash('sha256', $entry['file']);
            $cached = $cacheState->read($cacheKey);
            $valid = ($cached['rulesVersion'] ?? '') === self::RULES && ($cached['scopeVersion'] ?? '') === ScanScope::VERSION
                && ($cached['file'] ?? '') === $entry['file'] && isset($cached['fingerprint'], $cached['result']);
            $sameMetadata = $valid && $entry['modified'] !== null && $cached['bytes'] === $entry['bytes'] && $cached['modified'] === $entry['modified'];
            if ($sameMetadata && !$job['verify']) {
                $result = $cached['result']; $fingerprint = $cached['fingerprint']; ++$job['reused'];
            } else {
                $budget = $archive ? 'archiveBudgetUsed' : 'textBudgetUsed'; $maximum = $archive ? self::ARCHIVE_BUDGET : self::TEXT_BUDGET;
                if ($job[$budget] + $entry['bytes'] > $maximum) { throw new RuntimeException($archive
                    ? 'Packed-archive transfer budget reached. Loose-code results are retained; this archive was not downloaded.'
                    : 'Loose-code transfer budget reached. Existing results are retained; this file was not downloaded.'); }
                $job[$budget] += $entry['bytes'];
                $reserve = $entry['kind'] === 'archive' ? 2147483648 : $entry['bytes'];
                if (disk_free_space(dirname($path)) < $reserve + 1073741824) { throw new RuntimeException('Insufficient Panel disk space; the scanner preserves 1 GiB free.'); }
                $this->source->copy($server, $entry['file'], $entry, $path);
                $job['bytes'] += $entry['bytes']; $fingerprint = hash_file('sha256', $path);
                if ($valid && $cached['fingerprint'] === $fingerprint) { $result = $cached['result']; ++$job['reused']; }
                else {
                    $process = new Process(['/usr/bin/python3', '-I', __DIR__ . '/scan.py', $path, $entry['kind']]);
                    $process->setTimeout(24); $process->start();
                    try {
                        while ($process->isRunning()) {
                            if ($this->cancelled($server->uuid, $job)) { throw new RuntimeException('Scan cancelled.'); }
                            $process->checkTimeout(); usleep(100000);
                        }
                    } finally { if ($process->isRunning()) { $process->stop(0); } }
                    if (!$process->isSuccessful() || strlen($process->getOutput()) > 262144) { throw new RuntimeException('Static analysis exceeded its resource limit or failed.'); }
                    $result = json_decode($process->getOutput(), true, 20, JSON_THROW_ON_ERROR);
                    if (($result['rulesVersion'] ?? '') !== self::RULES) { throw new RuntimeException('Scanner rules version mismatch.'); }
                }
                if ($cached || $job['cacheSlots'] > 0) {
                    if (!$cached) { --$job['cacheSlots']; }
                    $cacheState->write($cacheKey, ['file' => $entry['file'], 'bytes' => $entry['bytes'], 'modified' => $entry['modified'],
                        'fingerprint' => $fingerprint, 'rulesVersion' => self::RULES, 'scopeVersion' => ScanScope::VERSION, 'result' => $result]);
                }
            }
            ++$job['filesScanned']; $job['scripts'] += $result['scripts'];
            if ($entry['kind'] === 'archive') { ++$job['archives']; }
            foreach ($result['issues'] as $issue) { $this->issue($job, $entry['file'] . ($issue['member'] ? ' :: ' . $issue['member'] : ''), $issue['reason']); }
            foreach ($result['findings'] as $finding) {
                $finding['fingerprint'] = $fingerprint;
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
            if ($this->cancelled($server->uuid, $job)) { throw new RuntimeException('Scan cancelled.'); }
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
        if (($job['manual'] ?? false) !== true || ($job['scopeVersion'] ?? '') !== ScanScope::VERSION || ($job['rulesVersion'] ?? '') !== self::RULES) {
            $this->state->write('scanner-cancel-' . $uuid, ['id' => $job['id']]);
        }
        if ($this->cancelled($uuid, $job)) { $this->settleCancellation($uuid); return; }
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
