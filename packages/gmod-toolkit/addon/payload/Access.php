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
        $user = $request->user();
        abort_unless($user, 403);
        // Keep each check independent: arrays in the frontend navigation mean OR.
        foreach ($write ? ['file.read', 'file.read-content', 'file.create', 'file.update'] : ['file.read', 'file.read-content'] as $permission) {
            abort_unless($user->can($permission, $server), 403, 'Missing server permission: ' . $permission);
        }
        $allowed = $this->state->read('settings')['eggs'] ?? [];
        abort_unless(in_array((int) $server->egg_id, $allowed, true), 404, 'GMod Toolkit is not enabled for this egg.');
    }
}
