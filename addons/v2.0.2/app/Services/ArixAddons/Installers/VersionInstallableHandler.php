<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Pterodactyl\Models\Server;

class VersionInstallableHandler
{
    public function __construct(
        private InstallableFileService $installableFileService,
        private VersionCatalogService  $versionCatalog,
    ) {
    }

    public function resolve(array $payload): array {
        $service = $payload['service'];
        $version = $payload['version'];
        $buildId = $payload['build_id'] ?? null;
        $loaderBuild = $payload['loader_build'] ?? null;
        $selectedVersion = $this->versionCatalog->selectDownloadRecord(
            $service,
            $version,
            is_string($buildId) ? $buildId : null,
            is_string($loaderBuild) ? $loaderBuild : null,
        );

        $downloadUrl = $this->installableFileService->qualifyUrl($selectedVersion['download_url']);
        $extension = $this->installableFileService->extensionFromUrl($downloadUrl);
        $filename = $extension === 'jar' ? 'server.jar' : "{$version}.{$extension}";

        return [
            'download_url' => $downloadUrl,
            'target_directory' => '/',
            'target_filename' => $filename,
            'allow_overwrite' => true,
            'delete_before_extraction' => $extension === 'zip' ? ['libraries', 'server.jar'] : [],
        ];
    }

    public function persist(Server $server, array $payload): Server {
        $server->update([
            'mc_version' => $payload['service'] . '|' . $payload['version'],
        ]);

        return $server;
    }
}
