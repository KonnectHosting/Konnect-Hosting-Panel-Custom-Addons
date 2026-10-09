<?php

namespace Pterodactyl\Http\Requests\Api\Client\VersionsAddon;

use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Server;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class ChangeVersionRequest extends ClientApiRequest
{
    public function authorize(): bool
    {
        if (!parent::authorize()) {
            return false;
        }

        $server = $this->route()->parameter('server');

        return $server instanceof Server
            && $this->user()->can(Permission::ACTION_FILE_CREATE, $server)
            && $this->user()->can(Permission::ACTION_FILE_UPDATE, $server)
            && $this->user()->can(Permission::ACTION_FILE_DELETE, $server);
    }

    public function rules(): array
    {
        return [
            'build_id' => ['nullable', 'string', 'max:191'],
        ];
    }
}
