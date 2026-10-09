<?php

namespace Pterodactyl\Transformers\Api\Client;

use Pterodactyl\Models\SubuserPreset;

class SubuserPresetTransformer extends BaseClientTransformer
{
    public function getResourceName(): string
    {
        return SubuserPreset::RESOURCE_NAME;
    }

    /**
     * Transform this model into a representation that can be consumed by a client.
     */
    public function transform(SubuserPreset $model): array
    {
        return [
            'id' => $model->id,
            'name' => $model->name,
            'permissions' => $model->permissions ?? [],
            'created_at' => $model->created_at->toAtomString(),
            'updated_at' => $model->updated_at->toAtomString(),
        ];
    }
}
