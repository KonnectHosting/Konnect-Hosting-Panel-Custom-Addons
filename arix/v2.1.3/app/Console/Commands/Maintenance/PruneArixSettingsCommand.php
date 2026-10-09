<?php

namespace Pterodactyl\Console\Commands\Maintenance;

use Illuminate\Console\Command;
use Pterodactyl\Models\Setting;

class PruneArixSettingsCommand extends Command
{
    protected $signature = 'p:maintenance:prune-arix-settings';

    protected $description = 'Deletes all Arix configuration settings stored under the settings::arix prefix.';

    public function handle(): void
    {
        $query = Setting::query()->where('key', 'like', 'settings::arix:%');
        $count = $query->count();

        if ($count === 0) {
            $this->info('There are no Arix settings to prune.');

            return;
        }

        $this->warn("Deleting $count Arix settings entries.");
        if (!$this->confirm('Are you sure you want to permanently delete these settings?', false)) {
            $this->info('Command aborted. No settings were deleted.');

            return;
        }

        $query->delete();
        $this->info("Successfully deleted $count Arix settings entries.");
    }
}
