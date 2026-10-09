<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Startup;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

/**
 * Shared request for both reading the list of startup commands (GET) and
 * switching the active one (PUT) — the two actions differ only in the
 * permission they require and whether an `id` is expected in the body.
 */
class StartupCommandRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return $this->isMethod('GET') ? Permission::ACTION_STARTUP_READ : Permission::ACTION_STARTUP_UPDATE;
    }

    public function rules(): array
    {
        return $this->isMethod('GET') ? [] : ['id' => 'required|integer|min:0'];
    }
}
