<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Carbon\CarbonImmutable;
use Illuminate\Http\Response;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Models\CommandHistory;
use Pterodactyl\Transformers\Api\Client\CommandHistoryTransformer;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\CommandHistoryRequest;

class CommandHistoryController extends ClientApiController
{
    /**
     * Returns the command history for a specific server.
     */
    public function index(CommandHistoryRequest $request, Server $server): array
    {
        $history = CommandHistory::where('server_id', $server->id)
            ->orderBy('executed_at', 'desc')
            ->limit(100)
            ->get();

        return $this->fractal->collection($history)
            ->transformWith($this->getTransformer(CommandHistoryTransformer::class))
            ->toArray();
    }

    /**
     * Stores a new command in the history.
     */
    public function store(CommandHistoryRequest $request, Server $server): array
    {
        $history = CommandHistory::create([
            'server_id' => $server->id,
            'command' => $request->input('command'),
            'executed_at' => CarbonImmutable::now(),
        ]);

        $count = CommandHistory::where('server_id', $server->id)->count();
        if ($count > 100) {
            $toRemove = $count - 100;
            CommandHistory::where('server_id', $server->id)
                ->orderBy('executed_at', 'asc')
                ->limit($toRemove)
                ->delete();
        }

        return $this->fractal->item($history)
            ->transformWith($this->getTransformer(CommandHistoryTransformer::class))
            ->toArray();
    }

    /**
     * Clears the command history for a specific server.
     */
    public function clear(CommandHistoryRequest $request, Server $server): JsonResponse
    {
        CommandHistory::where('server_id', $server->id)->delete();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }
}
