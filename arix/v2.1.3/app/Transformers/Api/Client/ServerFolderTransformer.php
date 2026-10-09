<?php

namespace Pterodactyl\Transformers\Api\Client;

use Pterodactyl\Models\ServerFolder;

class ServerFolderTransformer extends BaseClientTransformer
{
    /**
     * Return the resource name for the JSONAPI output.
     */
    public function getResourceName(): string
    {
        return 'server_folder';
    }

    /**
     * Transforms a ServerFolder model into a representation that can be shown to users.
     */
    public function transform(ServerFolder $model): array
    {
        return [
            'id' => $model->id,
            'name' => $model->name,
            'color' => $model->color,
            'icon' => $model->icon,
            'parent_id' => $model->parent_id,
            'servers' => $model->servers,
        ];
    }
}