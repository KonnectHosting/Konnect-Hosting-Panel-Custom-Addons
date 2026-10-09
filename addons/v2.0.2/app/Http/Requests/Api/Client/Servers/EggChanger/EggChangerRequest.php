<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\EggChanger;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

/**
 * Shared request for both listing the eggs a server may switch to (GET) and
 * performing the switch (PUT) — the two actions differ only in the
 * permission they require and whether a body is expected.
 */
class EggChangerRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return $this->isMethod('GET') ? Permission::ACTION_STARTUP_READ : Permission::ACTION_STARTUP_UPDATE;
    }

    public function rules(): array
    {
        return $this->isMethod('GET') ? [] : [
            'egg_id' => 'required|integer|exists:eggs,id',
            'update_startup' => 'sometimes|boolean',
            'reinstall' => 'sometimes|boolean',
        ];
    }
}
