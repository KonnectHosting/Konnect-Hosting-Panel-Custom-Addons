<?php

namespace Pterodactyl\Console\Commands\Maintenance;

use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Servers\SuspensionService;

class SuspendExpiredServersCommand extends Command
{
    protected $signature = 'p:maintenance:suspend-expired-servers';

    protected $description = 'Suspends all servers that have passed their expiration date.';

    public function __construct(private SuspensionService $suspensionService)
    {
        parent::__construct();
    }

    public function handle(): void
    {
        $servers = Server::query()
            ->whereNotNull('expiration_date')
            ->where('expiration_date', '<=', CarbonImmutable::now())
            ->where(function ($query) {
                $query->whereNull('status')->orWhere('status', '!=', Server::STATUS_SUSPENDED);
            })
            ->get();

        if ($servers->isEmpty()) {
            $this->info('There are no expired servers to suspend.');

            return;
        }

        $count = $servers->count();

        $this->warn("Suspending $count expired servers.");

        foreach ($servers as $server) {
            try {
                $this->suspensionService->toggle($server, SuspensionService::ACTION_SUSPEND);
            } catch (\Throwable $exception) {
                Log::warning($exception, ['server_id' => $server->id]);
            }
        }

        $this->info("Successfully suspended $count expired servers.");
    }
}
