<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Files;

use Pterodactyl\Models\Permission;
use Pterodactyl\Contracts\Http\ClientPermissionsRequest;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class TrashbinRequest extends ClientApiRequest implements ClientPermissionsRequest
{
    public function permission(): string
    {
        return match ($this->route()?->getActionMethod()) {
            'move', 'delete' => Permission::ACTION_FILE_DELETE,
            'restore' => Permission::ACTION_FILE_UPDATE,
            default => Permission::ACTION_FILE_READ,
        };
    }

    public function rules(): array
    {
        return match ($this->route()?->getActionMethod()) {
            'move' => [
                'root' => 'required|nullable|string',
                'files' => 'required|array',
                'files.*' => 'string',
            ],
            'restore', 'delete' => [
                'files' => 'required|array',
                'files.*' => 'string',
            ],
            default => [
                'directory' => 'sometimes|nullable|string',
            ],
        };
    }
}
