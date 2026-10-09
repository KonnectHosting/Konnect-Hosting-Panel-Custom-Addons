<?php

namespace Pterodactyl\Http\Requests\Api\Client\Servers\Subusers;

use Illuminate\Http\Request;
use Pterodactyl\Models\Permission;
use Pterodactyl\Exceptions\Http\HttpForbiddenException;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Services\Servers\GetUserPermissionsService;

class SubuserPresetRequest extends ClientApiRequest
{
    public function permission(): string
    {
        return match ($this->method()) {
            Request::METHOD_GET => Permission::ACTION_USER_READ,
            Request::METHOD_POST => Permission::ACTION_USER_CREATE,
            Request::METHOD_PUT => Permission::ACTION_USER_UPDATE,
            Request::METHOD_DELETE => Permission::ACTION_USER_DELETE,
            default => Permission::ACTION_USER_READ,
        };
    }

    /**
     * @throws \Illuminate\Contracts\Container\BindingResolutionException
     */
    public function authorize(): bool
    {
        if (!parent::authorize()) {
            return false;
        }

        if (in_array($this->method(), [Request::METHOD_POST, Request::METHOD_PUT], true) && $this->has('permissions')) {
            $this->validatePermissionsCanBeAssigned($this->input('permissions') ?? []);
        }

        return true;
    }

    public function rules(): array
    {
        return match ($this->method()) {
            Request::METHOD_POST => [
                'name' => 'required|string|between:1,191',
                'permissions' => 'required|array',
                'permissions.*' => 'string',
            ],
            Request::METHOD_PUT => [
                'preset_id' => 'required|integer|min:1|exists:subuser_presets,id',
                'name' => 'required|string|between:1,191',
                'permissions' => 'required|array',
                'permissions.*' => 'string',
            ],
            Request::METHOD_DELETE => [
                'preset_id' => 'required|integer|min:1|exists:subuser_presets,id',
            ],
            default => [],
        };
    }

    /**
     * Validates that the permissions we are trying to assign can actually be assigned
     * by the user making the request.
     *
     * @throws \Illuminate\Contracts\Container\BindingResolutionException
     */
    protected function validatePermissionsCanBeAssigned(array $permissions): void
    {
        $user = $this->user();
        /** @var \Pterodactyl\Models\Server $server */
        $server = $this->route()->parameter('server');

        // If we are a root admin or the server owner, no need to perform these checks.
        if ($user->root_admin || $user->id === $server->owner_id) {
            return;
        }

        $service = $this->container->make(GetUserPermissionsService::class);

        if (count(array_diff($permissions, $service->handle($server, $user))) > 0) {
            throw new HttpForbiddenException('Cannot assign permissions in a preset that your account does not actively possess.');
        }
    }
}
