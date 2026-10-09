<?php

namespace Pterodactyl\Console\Commands\Maintenance;

use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\Subuser;
use Pterodactyl\Repositories\Wings\DaemonRevocationRepository;
use Pterodactyl\Exceptions\Http\Connection\DaemonConnectionException;

class PruneExpiredSubusersCommand extends Command
{
    protected $signature = 'p:maintenance:prune-subusers';

    protected $description = 'Deletes all subusers that have passed their expiration date.';

    public function __construct(private DaemonRevocationRepository $revocationRepository)
    {
        parent::__construct();
    }

    public function handle(): void
    {
        $subusers = Subuser::query()
            ->with(['server.node', 'user'])
            ->whereNotNull('expires_at')
            // Delete subusers that expire within 1 hour
            ->where('expires_at', '<=', CarbonImmutable::now()->addHour())
            ->get();

        if ($subusers->isEmpty()) {
            $this->info('There are no expired subusers to delete.');

            return;
        }

        $count = $subusers->count();

        $this->warn("Deleting $count expired subusers.");

        foreach ($subusers as $subuser) {
            try {
                $this->revocationRepository->setNode($subuser->server->node)->deauthorize(
                    $subuser->user->uuid,
                    [$subuser->server->uuid],
                );
            } catch (DaemonConnectionException $exception) {
                Log::warning($exception, ['user_id' => $subuser->user_id, 'server_id' => $subuser->server_id]);
            }

            $subuser->delete();
        }

        $this->info("Successfully deleted $count expired subusers.");
    }
}
