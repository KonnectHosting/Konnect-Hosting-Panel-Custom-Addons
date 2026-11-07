<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use AddonManager\Laravel\{AddonJob,ExtensionRegistry};
use Closure;
use GuzzleHttp\Psr7\Response;
use Illuminate\Contracts\Bus\Dispatcher;
use Psr\Http\Message\ResponseInterface;
use Pterodactyl\Models\{Server,Task,User,Permission};
use Pterodactyl\Repositories\Wings\DaemonPowerRepository;
use RuntimeException;

/** Holds Panel-originated starts; never installs code on a game server. */
class StartGuard
{
    private static array $forwarding = [];
    private Closure $enqueue;
    private Closure $send;

    public function __construct(private State $state, private BackdoorScanner $scanner, private Access $access, ?Closure $enqueue = null, ?Closure $send = null)
    {
        $this->enqueue = $enqueue ?? static function (array $payload, int $delay): mixed {
            app(ExtensionRegistry::class)->guard('gmod.toolkit', BackdoorScanner::VERSION, 'system');
            $job = (new AddonJob('gmod.toolkit', BackdoorScanner::VERSION, 'power-check', $payload))->delay($delay);
            return app(Dispatcher::class)->dispatch($job);
        };
        $this->send = $send ?? static fn (Server $server, string $signal) => app(DaemonPowerRepository::class)->setServer($server)->send($signal);
    }

    public static function intercept(Server $server, string $signal): ?ResponseInterface
    {
        if (isset(self::$forwarding[$server->uuid])) { return null; }
        $manifest = app(ExtensionRegistry::class)->enabled()['gmod.toolkit'] ?? null;
        if (($manifest['version'] ?? '') !== BackdoorScanner::VERSION) { return null; }
        $guard = app(self::class);
        if (!$guard->access->eligible($server)) { return null; }
        if (in_array($signal, ['stop','kill'], true)) { $guard->cancel($server); return null; }
        if (!in_array($signal, ['start','restart'], true)) { return null; }
        $actor = (app()->bound('request') ? request()->user() : null) ?? User::find($server->owner_id);
        $guard->request($server, $actor, $signal);
        return new Response(202, ['Content-Type' => 'application/json'], json_encode(['message' => 'Checking new and changed code. The requested power action is queued until checks pass.']));
    }

    public static function websocketPermissions(Server $server, array $permissions): array
    {
        $manifest = app(ExtensionRegistry::class)->enabled()['gmod.toolkit'] ?? null;
        if (($manifest['version'] ?? '') !== BackdoorScanner::VERSION || !app(self::class)->access->eligible($server)) { return $permissions; }
        if (in_array('*', $permissions, true)) {
            $permissions = array_values(array_diff($permissions, ['*']));
            foreach (Permission::permissions() as $group => $definition) {
                foreach (array_keys($definition['keys']) as $key) { $permissions[] = $group . '.' . $key; }
            }
        }
        // Fresh customer websocket tokens cannot bypass the Panel start check.
        // Stop/kill also use the Panel so they cancel any queued start first.
        return [...array_values(array_unique(array_diff($permissions, ['control.start','control.restart','control.stop']))), 'gmod.toolkit.guarded-power'];
    }

    public function request(Server $server, ?User $actor, string $signal): array
    {
        if (!in_array($signal, ['start','restart'], true)) { throw new RuntimeException('Unsupported guarded power action.'); }
        abort_unless($actor && $actor->can(Task::permissionForAction(Task::ACTION_POWER, $signal), $server), 403);
        abort_unless($this->access->eligible($server), 404); $server->validateCurrentState();
        if (in_array(config('queue.default'), ['sync','null'], true)) { throw new RuntimeException('Start checks need the Panel asynchronous queue.'); }
        $key = 'scanner-power-' . $server->uuid;
        $enqueue = false;
        $record = $this->state->locked($key, function () use ($key, $server, $actor, $signal, &$enqueue) {
            $record = $this->state->read($key);
            if (($record['status'] ?? '') === 'pending' && $record['expires'] > time() && !$this->cancelled($server->uuid, $record)) {
                if (($record['updated'] ?? 0) < time() - 90) { $record['updated'] = time(); $this->state->write($key, $record); $enqueue = true; }
                return $record;
            }
            $enqueue = true;
            $record = ['nonce' => bin2hex(random_bytes(32)), 'server' => $server->id, 'actor' => $actor->id, 'signal' => $signal,
                'created' => microtime(true), 'updated' => time(), 'expires' => time() + 7200, 'scan' => null, 'status' => 'pending',
                'message' => 'Checking new and changed code before the requested start/restart.'];
            $this->state->write($key, $record);
            return $record;
        });
        if ($enqueue) { $this->dispatch($server->uuid, $record, 0); }
        return ['status' => 'pending'];
    }

    private function cancelled(string $uuid, array $record): bool
    {
        return ($this->state->read('scanner-power-cancel-' . $uuid)['at'] ?? 0) >= $record['created'];
    }

    public function cancelRequest(Server $server, User $actor): array
    {
        abort_unless($this->access->eligible($server), 404);
        $record = $this->state->read('scanner-power-' . $server->uuid);
        abort_unless($actor->can('control.stop', $server) || (($record['actor'] ?? null) === $actor->id
            && $actor->can(Task::permissionForAction(Task::ACTION_POWER, $record['signal']), $server)), 403);
        $this->cancel($server);
        $scan = $this->scanner->info($server)['scan'];
        if (($scan['status'] ?? '') === 'running' && ($scan['id'] ?? '') === ($record['scan'] ?? null)) { $this->scanner->cancel($server, $actor); }
        $current = $this->state->read('scanner-power-' . $server->uuid);
        return ['message' => ($current['status'] ?? '') === 'sent' ? 'The power action was already sent. Use Stop to stop the server.' : 'Queued start/restart cancelled.'];
    }

    public function cancel(Server $server): void
    {
        // This separate atomic marker keeps stop/kill available during scan locks.
        $this->state->write('scanner-power-cancel-' . $server->uuid, ['at' => microtime(true)]);
        try {
            $key = 'scanner-power-' . $server->uuid;
            $this->state->locked($key, function () use ($key) {
                $record = $this->state->read($key);
                if (($record['status'] ?? '') === 'pending') { $record['status'] = 'cancelled'; $record['message'] = 'Queued start/restart cancelled by stop/kill.'; $this->state->write($key, $record); }
            });
        } catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $error) { if ($error->getStatusCode() !== 409) { throw $error; } }
    }

    private function dispatch(string $uuid, array $record, int $delay): void
    {
        try { ($this->enqueue)(['uuid' => $uuid, 'server' => $record['server'], 'nonce' => $record['nonce']], $delay); }
        catch (\Throwable $error) {
            $key = 'scanner-power-' . $uuid;
            $this->state->locked($key, function () use ($key, $record) {
                $current = $this->state->read($key);
                if (($current['nonce'] ?? '') === $record['nonce'] && ($current['status'] ?? '') === 'pending') {
                    $current['status'] = 'blocked'; $current['message'] = 'The Panel queue could not accept the start check. Check the queue and retry.';
                    $this->state->write($key, $current);
                }
            });
            throw new RuntimeException('The Panel queue could not accept the start check.', 0, $error);
        }
    }

    public function handle(array $payload): void
    {
        $uuid = (string) ($payload['uuid'] ?? '');
        if (!preg_match('/^[a-f0-9-]{36}$/D', $uuid)) { return; }
        $key = 'scanner-power-' . $uuid; $next = null;
        $this->state->locked($key, function () use ($key, $uuid, $payload, &$next) {
            $record = $this->state->read($key);
            if (($record['nonce'] ?? '') !== ($payload['nonce'] ?? null) || ($record['status'] ?? '') !== 'pending') { return; }
            try {
                if ($this->cancelled($uuid, $record)) { $record['status'] = 'cancelled'; $record['message'] = 'Queued start/restart cancelled by stop/kill.'; }
                else {
                    $server = Server::find($record['server']); $actor = User::find($record['actor']);
                    if (!$server || $server->uuid !== $uuid || !$actor || $record['expires'] < time()) { throw new RuntimeException('Start check expired or its server/user is unavailable.'); }
                    abort_unless($actor->can(Task::permissionForAction(Task::ACTION_POWER, $record['signal']), $server), 403);
                    abort_unless($this->access->eligible($server), 404); $server->validateCurrentState();
                    $scan = $this->scanner->info($server)['scan'];
                    if ($record['scan'] === null) {
                        if (($scan['status'] ?? '') !== 'running') {
                            $options = $this->state->read('scanner-options-' . $uuid);
                            // Metadata can be preserved by SFTP. Hash selected code
                            // before power, while reusing unchanged analysis results.
                            $started = $this->scanner->start($server, $server->owner_id, (bool) ($options['archives'] ?? false), true);
                            $record['scan'] = $started['id'];
                        }
                        $next = true;
                    } elseif (($scan['id'] ?? '') !== $record['scan']) { throw new RuntimeException('The start-check scan was replaced. Request start/restart again.'); }
                    elseif ($scan['status'] === 'running') { $next = true; }
                    elseif ($scan['status'] !== 'complete' || ($scan['blockingIssues'] ?? 1) > 0 || ($scan['unapprovedHigh'] ?? 1) > 0) {
                        throw new RuntimeException('Start held: review new high-priority findings or uninspected code in Backdoor Scanner, then request start/restart again.');
                    } else {
                        if ($this->cancelled($uuid, $record)) { throw new RuntimeException('Start check was cancelled.'); }
                        self::$forwarding[$uuid] = true;
                        try { ($this->send)($server, $record['signal']); }
                        finally { unset(self::$forwarding[$uuid]); }
                        $record['status'] = 'sent'; $record['message'] = 'Selected code checks passed; the requested power action was sent to Wings.';
                    }
                }
            } catch (\Throwable $error) {
                $record['status'] = 'blocked';
                $record['message'] = $error instanceof RuntimeException && !$error instanceof \GuzzleHttp\Exception\GuzzleException
                    ? substr($error->getMessage(), 0, 300) : 'Start held: the server state, permissions or Panel/Wings connection changed. Retry after resolving it.';
            }
            $record['updated'] = time(); $this->state->write($key, $record);
            if ($next && $record['status'] === 'pending') { $next = $record; } else { $next = null; }
        });
        if ($next) { $this->dispatch($uuid, $next, 15); }
    }
}
