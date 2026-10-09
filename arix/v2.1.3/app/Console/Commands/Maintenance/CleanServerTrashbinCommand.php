<?php

namespace Pterodactyl\Console\Commands\Maintenance;

use Throwable;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Trashbin;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Illuminate\Contracts\Cache\Repository as CacheRepository;
use Pterodactyl\Services\Servers\Files\TrashbinService;

class CleanServerTrashbinCommand extends Command
{
    protected $signature = 'p:maintenance:clean-server-trashbin';

    protected $description = 'Delete old trashbin entities older than the configured grace period for all servers.';

    public function __construct(
        private TrashbinService $trashbinService,
        private CacheRepository $cache,
        private SettingsRepositoryInterface $settings
    )
    {
        parent::__construct();
    }

    public function handle(): void
    {
        $gracePeriod = (int) $this->settings->get('settings::arix:advanced:gracePeriod', 7);
        if ($gracePeriod < 0) {
            $gracePeriod = 0;
        }

        $cacheDays = max($gracePeriod - 1, 0);

        $threshold = CarbonImmutable::now()->subDays($gracePeriod);
        $databaseThreshold = CarbonImmutable::now()->subDays($gracePeriod);
        $deleted = 0;

        Server::query()->each(function (Server $server) use (&$deleted, $threshold, $cacheDays) {
            $cacheKey = sprintf('server:%d:trashbin:list', $server->id);
            $items = $this->cache->remember($cacheKey, CarbonImmutable::now()->addDays($cacheDays), function () use ($server) {
                return $this->trashbinService->list($server);
            });

            $expired = array_values(array_filter($items, function (array $item) use ($threshold) {
                $timestamp = $item['created_at'] ?? null;
                if (is_null($timestamp) || $timestamp === '') {
                    return false;
                }

                try {
                    $parsed = CarbonImmutable::parse((string) $timestamp);
                } catch (Throwable) {
                    return false;
                }

                if ($parsed->year <= 1970) {
                    return false;
                }

                return $parsed->lte($threshold);
            }));

            if (!empty($expired)) {
                try {
                    $this->trashbinService->delete(
                        $server,
                        array_values(array_map(fn (array $item) => $item['trash_name'], $expired))
                    );

                    $this->cache->forget($cacheKey);
                    $deleted += count($expired);
                } catch (Throwable $exception) {
                    $this->warn(sprintf('Failed cleaning server %d trashbin: %s', $server->id, $exception->getMessage()));
                }
            }

            usleep(500000);
        });

        $deletedMetadata = Trashbin::query()
            ->where('created_at', '<=', $databaseThreshold)
            ->delete();

        $this->info(sprintf('Deleted %d expired trashbin entities.', $deleted));
        $this->info(sprintf('Deleted %d expired trashbin metadata rows.', $deletedMetadata));
    }
}
