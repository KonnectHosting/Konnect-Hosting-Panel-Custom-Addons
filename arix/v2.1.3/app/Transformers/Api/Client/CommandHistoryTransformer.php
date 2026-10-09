<?php

namespace Pterodactyl\Transformers\Api\Client;

use Pterodactyl\Models\CommandHistory;

class CommandHistoryTransformer extends BaseClientTransformer
{
    public function getResourceName(): string
    {
        return CommandHistory::RESOURCE_NAME;
    }

    /**
     * Transforms a command history entry into a client viewable format.
     */
    public function transform(CommandHistory $model): array
    {
        return [
            'id' => $model->id,
            'command' => $model->command,
            'executed_at' => $model->executed_at->toAtomString(),
        ];
    }
}
