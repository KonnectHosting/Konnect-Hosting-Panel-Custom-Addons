<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Pterodactyl\Helpers\ArixAddons;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class VersionCatalogService
{
    public function getServices(): mixed {
        return $this->request('versions', 48);
    }

    public function getVersions(string $service): mixed {
        return $this->request($this->versionsEndpoint($service));
    }

    public function selectDownloadRecord(
        string  $service,
        string  $version,
        ?string $buildId = null,
        ?string $loaderBuild = null,
    ): array {
        if ($buildId !== null && $buildId !== '') {
            return $this->requireDownloadRecord(
                collect($this->getBuilds($service, $version))->firstWhere('build_id', $buildId),
                'Version build not found.',
            );
        }

        if ($loaderBuild !== null && $loaderBuild !== '') {
            $builds = $this->getBuilds($service, $version);
            $matchedBuildId = $this->matchLoaderBuild($builds, $loaderBuild);

            if ($matchedBuildId !== null) {
                return $this->requireDownloadRecord(
                    collect($builds)->firstWhere('build_id', $matchedBuildId),
                    'Version build not found.',
                );
            }
        }

        return $this->requireDownloadRecord(
            collect($this->getVersions($service))->firstWhere('version', $version),
            'Version not found.',
        );
    }

    private function getBuilds(string $service, string $version): mixed {
        return $this->request($this->buildsEndpoint($service, $version));
    }

    private function matchLoaderBuild(mixed $builds, string $loaderBuild): ?string {
        $matches = collect($builds)
            ->filter(fn($build) => is_array($build)
                && isset($build['build_id'], $build['name'])
                && is_string($build['build_id'])
                && is_string($build['name'])
                && ($build['build_id'] === $loaderBuild
                    || $this->buildNameContainsLoaderVersion($build['name'], $loaderBuild)))
            ->pluck('build_id')
            ->unique()
            ->values();

        return $matches->count() === 1 ? $matches->first() : null;
    }

    private function buildNameContainsLoaderVersion(string $name, string $loaderVersion): bool {
        return preg_match(
                '/(^|[^0-9A-Za-z])' . preg_quote($loaderVersion, '/') . '($|[^0-9A-Za-z])/',
                $name,
            ) === 1;
    }

    private function requireDownloadRecord(mixed $record, string $message): array {
        if (!is_array($record) || !is_string($record['download_url'] ?? null) || $record['download_url'] === '') {
            throw new NotFoundHttpException($message);
        }

        return $record;
    }

    private function versionsEndpoint(string $service): string {
        return 'versions/' . rawurlencode($service);
    }

    private function buildsEndpoint(string $service, string $version): string {
        return sprintf('%s/%s/builds', $this->versionsEndpoint($service), rawurlencode($version));
    }

    private function request(string $endpoint, int $cacheHours = 1): mixed {
        return ArixAddons::licensedRequestToApi($endpoint, [], false, 'GET', $cacheHours);
    }
}
