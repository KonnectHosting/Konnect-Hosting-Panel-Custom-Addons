<?php

namespace Pterodactyl\Services\Servers;

use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerVariable;
use Illuminate\Database\ConnectionInterface;

class EggChangerService
{
    public function __construct(private ConnectionInterface $connection)
    {
    }

    /**
     * Switches a server over to a different egg. Variable values tied to the
     * previous egg are dropped; values for the new egg are seeded with their
     * defaults unless the server already holds a value for that exact
     * variable (e.g. the server previously ran this egg before).
     *
     * @throws \Throwable
     */
    public function handle(Server $server, Egg $targetEgg, bool $updateStartup): Server
    {
        return $this->connection->transaction(function () use ($server, $targetEgg, $updateStartup) {
            $server->forceFill([
                'egg_id' => $targetEgg->id,
                'nest_id' => $targetEgg->nest_id,
            ]);

            if ($updateStartup) {
                $server->startup = $targetEgg->startup;

                $images = array_values($targetEgg->docker_images ?? []);
                if (!empty($images) && !in_array($server->image, $images, true)) {
                    $server->image = $images[0];
                }
            }

            $server->saveOrFail();

            $variableIds = $targetEgg->variables()->pluck('id');

            ServerVariable::query()
                ->where('server_id', $server->id)
                ->whereNotIn('variable_id', $variableIds)
                ->delete();

            foreach ($targetEgg->variables as $variable) {
                ServerVariable::query()->firstOrCreate(
                    ['server_id' => $server->id, 'variable_id' => $variable->id],
                    ['variable_value' => $variable->default_value ?? '']
                );
            }

            return $server->fresh();
        });
    }
}
