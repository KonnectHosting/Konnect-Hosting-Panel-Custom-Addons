<?php

namespace Pterodactyl\Http\Controllers\Admin\Nests;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Pterodactyl\Http\Controllers\Controller;

class EggRepositoryController extends Controller
{
    private const REPOSITORIES = [
        'application' => 'application-eggs',
        'game' => 'game-eggs',
        'generic' => 'generic-eggs',
    ];

    private const CACHE_HOURS = 6;

    /**
     * Lists the available egg ".json" files for the given Pterodactyl egg
     * repository ("application", "game" or "generic"), sourced from GitHub.
     */
    public function index(string $type): JsonResponse
    {
        if (!array_key_exists($type, self::REPOSITORIES)) {
            return response()->json([
                'error' => 'Unknown egg repository type.',
            ], 404);
        }

        $repository = self::REPOSITORIES[$type];

        $eggs = Cache::remember(
            "egg_repository.{$repository}",
            60 * 60 * self::CACHE_HOURS,
            fn () => $this->fetchEggs($repository),
        );

        if ($eggs === null) {
            return response()->json([
                'error' => 'Unable to fetch eggs from GitHub, please try again later.',
            ], 502);
        }

        return response()->json($eggs);
    }

    /**
     * @return array<int, array{name: string, raw_url: string, parent_groups: string[]}>|null
     */
    private function fetchEggs(string $repository): ?array
    {
        $request = Http::acceptJson()->withHeaders([
            'User-Agent' => 'Pterodactyl-Panel',
        ]);

        $response = $request->get("https://api.github.com/repos/pterodactyl/{$repository}/git/trees/main", [
            'recursive' => 1,
        ]);

        if (!$response->successful()) {
            return null;
        }

        $tree = $response->json('tree') ?? [];

        return collect($tree)
            ->filter(function (array $item) {
                $path = $item['path'] ?? '';

                // Egg repositories also contain unrelated ".json" files (bot configs, world
                // saves, server settings, etc). Only files matching the "egg-*.json" naming
                // convention used by Pterodactyl's egg exports are actual eggs.
                return ($item['type'] ?? null) === 'blob'
                    && str_ends_with($path, '.json')
                    && str_starts_with(strtolower(basename($path)), 'egg');
            })
            ->map(function (array $item) use ($repository) {
                $segments = explode('/', $item['path']);
                array_pop($segments); 
                array_pop($segments);
                $filename = basename($item['path']);

                return [
                    'name' => preg_replace('/\.json$/', '', $filename),
                    'information' => "https://eggs.pterodactyl.io/egg/" . preg_replace('/-eggs$/', 's', $repository) . "-" . preg_replace('/^egg-/', '', str_replace('.json', '', $filename)),
                    'raw_url' => "https://raw.githubusercontent.com/pterodactyl/{$repository}/main/{$item['path']}",
                    'parent_groups' => $segments,
                ];
            })
            ->values()
            ->all();
    }
}
