<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Response;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\SubuserPreset;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Transformers\Api\Client\SubuserPresetTransformer;
use Pterodactyl\Http\Requests\Api\Client\Servers\Subusers\SubuserPresetRequest;

class SubuserPresetController extends ClientApiController
{
    /**
     * Return all subuser presets associated with this server instance.
     */
    public function index(SubuserPresetRequest $request, Server $server): array
    {
        $presets = SubuserPreset::query()
            ->where('server_id', $server->id)
            ->orderBy('name')
            ->get();

        return $this->fractal->collection($presets)
            ->transformWith($this->getTransformer(SubuserPresetTransformer::class))
            ->toArray();
    }

    /**
     * Create a new subuser preset for this server.
     */
    public function store(SubuserPresetRequest $request, Server $server): array
    {
        $preset = SubuserPreset::query()->create([
            'server_id' => $server->id,
            'name' => $request->input('name'),
            'permissions' => $this->getDefaultPermissions($request),
        ]);

        return $this->fractal->item($preset)
            ->transformWith($this->getTransformer(SubuserPresetTransformer::class))
            ->toArray();
    }

    /**
     * Update a subuser preset for this server.
     */
    public function update(SubuserPresetRequest $request, Server $server): array
    {
        $preset = SubuserPreset::query()
            ->where('server_id', $server->id)
            ->where('id', $request->integer('preset_id'))
            ->firstOrFail();

        $preset->update([
            'name' => $request->input('name'),
            'permissions' => $this->getDefaultPermissions($request),
        ]);

        return $this->fractal->item($preset->refresh())
            ->transformWith($this->getTransformer(SubuserPresetTransformer::class))
            ->toArray();
    }

    /**
     * Delete a subuser preset for this server.
     */
    public function delete(SubuserPresetRequest $request, Server $server): JsonResponse
    {
        $preset = SubuserPreset::query()
            ->where('server_id', $server->id)
            ->where('id', $request->integer('preset_id'))
            ->firstOrFail();

        $preset->delete();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    /**
     * Returns the default permissions for subuser presets and parses out any permissions
     * that were passed that do not also exist in the internally tracked list of
     * permissions.
     */
    protected function getDefaultPermissions(SubuserPresetRequest $request): array
    {
        $allowed = Permission::permissions()
            ->map(function ($value, $prefix) {
                return array_map(function ($value) use ($prefix) {
                    return "$prefix.$value";
                }, array_keys($value['keys']));
            })
            ->flatten()
            ->all();

        $cleaned = array_intersect($request->input('permissions') ?? [], $allowed);

        return array_unique(array_merge($cleaned, [Permission::ACTION_WEBSOCKET_CONNECT]));
    }
}
