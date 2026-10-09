<?php

namespace Pterodactyl\Console\Commands\Maintenance;

use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\ApiKey;

class PruneExpiredApiKeysCommand extends Command
{
    protected $signature = 'p:maintenance:prune-api-keys';

    protected $description = 'Deletes all API keys that have passed their expiration date.';

    public function handle(): void
    {
        $query = ApiKey::query()
            ->whereNotNull('expires_at')
            // Delete keys that expire within 1 hour
            ->where('expires_at', '<=', CarbonImmutable::now()->addHour());

        $count = $query->count();
        if (!$count) {
            $this->info('There are no expired API keys to delete.');

            return;
        }

        $this->warn("Deleting $count expired API keys.");

        $query->delete();

        $this->info("Successfully deleted $count expired API keys.");
    }
}
