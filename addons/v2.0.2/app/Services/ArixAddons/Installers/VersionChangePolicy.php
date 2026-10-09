<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Illuminate\Filesystem\Filesystem;
use Pterodactyl\Models\Server;

class VersionChangePolicy
{
    private array $disallowedServicesByEgg = [];

    public function __construct(private Filesystem $filesystem) {
    }

    public function allows(Server $server, string $service): bool {
        $disallowed = $this->disallowedServicesFor($server);

        return $this->serviceIsAllowed($service, $disallowed);
    }

    public function filterAllowed(Server $server, array $services): array {
        $disallowed = $this->disallowedServicesFor($server);

        return array_values(array_filter(
            $services,
            fn($service) => is_string($service) && $this->serviceIsAllowed($service, $disallowed),
        ));
    }

    private function serviceIsAllowed(string $service, array $disallowed): bool {
        return !in_array('*', $disallowed, true)
            && !in_array(strtolower($service), $disallowed, true);
    }

    private function disallowedServicesFor(Server $server): array {
        $eggId = (string)$server->egg_id;
        if (array_key_exists($eggId, $this->disallowedServicesByEgg)) {
            return $this->disallowedServicesByEgg[$eggId];
        }

        $path = base_path('version_changer_disallowed_eggs.json');
        $rules = $this->filesystem->exists($path)
            ? json_decode($this->filesystem->get($path), true)
            : [];

        return $this->disallowedServicesByEgg[$eggId] = collect(is_array($rules) ? ($rules[$eggId] ?? []) : [])
            ->filter(fn($service) => is_string($service))
            ->map(fn(string $service) => strtolower($service))
            ->unique()
            ->values()
            ->all();
    }
}
