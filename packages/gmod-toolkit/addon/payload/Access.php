<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;

final class Access
{
    public function __construct(private State $state) {}

    public function check(Request $request, Server $server, bool $write = false): void
    {
        $this->checkUser($request->user(), $server, $write);
    }

    public function eligible(Server $server): bool
    {
        $settings = $this->state->read('settings');
        if (array_key_exists('eggs', $settings)) { return in_array((int) $server->egg_id, $settings['eggs'], true); }
        $egg = $server->egg;
        return (bool) preg_match('/garry.?s.?mod|\bgmod\b/i', (string) $egg?->name)
            || (bool) preg_match('/(?:^|\s)-game\s+garrysmod(?:\s|$)/i', (string) $egg?->startup);
    }

    public function checkUser(?\Pterodactyl\Models\User $user, Server $server, bool $write = false): void
    {
        abort_unless($user, 403);
        // Keep each check independent: arrays in the frontend navigation mean OR.
        foreach ($write ? ['file.read', 'file.read-content', 'file.create', 'file.update'] : ['file.read', 'file.read-content'] as $permission) {
            abort_unless($user->can($permission, $server), 403, 'Missing server permission: ' . $permission);
        }
        abort_unless($this->eligible($server), 404, 'GMod Toolkit is not enabled for this egg.');
    }
}
