<?php

namespace Pterodactyl\Transformers\Api\Client;

use Pterodactyl\Models\ServerOrder;

class ServerOrderTransformer extends BaseClientTransformer
{
    /**
     * Return the resource name for the JSONAPI output.
     */
    public function getResourceName(): string
    {
        return 'server_order';
    }

    /**
     * Transforms a ServerOrder model into a representation that can be shown to users.
     */
    public function transform(ServerOrder $model): array
    {
        return [
            'server_ordered' => $model->server_ordered,
        ];
    }
}