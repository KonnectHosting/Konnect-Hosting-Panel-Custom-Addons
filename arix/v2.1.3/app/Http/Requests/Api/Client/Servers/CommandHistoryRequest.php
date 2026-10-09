<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers;

use Pterodactyl\Models\Permission;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;

class CommandHistoryRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return Permission::ACTION_CONTROL_CONSOLE;
    }

    public function rules(): array
    {
        if ($this->isMethod('POST')) {
            return [
                'command' => 'required|string|max:1000',
            ];
        }

        return [];
    }
}
