<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Pterodactyl\Models\Plugins\InstalledPlugins;
use Pterodactyl\Models\Server;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ModpackInstallableHandler
{
    public function __construct(
        private PluginInstallableHandler $pluginHandler,
        private InstallableFileService   $installableFileService,
    ) {
    }

    public function resolve(Server $server, array $payload): array {
        $service = $payload['plugin_service'];
        $this->rejectIfAlreadyInstalled($server, $payload);

        $selectedVersion = $this->selectedVersion($payload);
        $downloadUrl = $this->downloadUrl($service, $selectedVersion);

        return match ($service) {
            'modrinth' => $this->buildInstallable($payload, $downloadUrl, 'modrinth-mrpack', 'mrpack'),
            'curseforge' => $this->buildInstallable($payload, $downloadUrl, 'merge-archive', 'zip', stripSingleTopLevelDirectory: true),
            default => throw new BadRequestHttpException('Unsupported modpack service.'),
        };
    }

    public function persist(Server $server, array $payload, array $result): InstalledPlugins {
        return $this->pluginHandler->persist($server, $payload, $result);
    }

    private function buildInstallable(
        array  $payload,
        string $downloadUrl,
        string $mode,
        string $extension,
        bool   $stripSingleTopLevelDirectory = false,
    ): array {
        return [
            'mode' => $mode,
            'target_directory' => '/',
            'target_filename' => $this->installableFileService->buildFilename(
                $payload['plugin_name'],
                $payload['plugin_version'],
                $extension,
                'modpack-install',
            ),
            'download_url' => $downloadUrl,
            'strip_single_top_level_directory' => $stripSingleTopLevelDirectory,
            'allow_overwrite' => false,
            'delete_before_extraction' => [],
        ];
    }

    private function selectedVersion(array $payload): array {
        $selectedVersion = $this->pluginHandler->selectVersion(
            $payload['catalog_route'],
            $payload['plugin_version'],
            'Modpack',
        );

        if (!isset($selectedVersion['url']) && !isset($selectedVersion['serverpack_url'])) {
            throw new NotFoundHttpException('Modpack version not found.');
        }

        return $selectedVersion;
    }

    private function downloadUrl(string $service, array $selectedVersion): string {
        // A normal CurseForge modpack archive only contains a manifest and
        // overrides. It is not a server distribution and cannot be merged
        // directly into a server filesystem.
        $url = match ($service) {
            'curseforge' => $selectedVersion['serverpack_url'] ?? null,
            'modrinth' => $selectedVersion['url'] ?? null,
            default => null,
        };

        if (!is_string($url) || $url === '') {
            throw new NotFoundHttpException($service === 'curseforge'
                ? 'This CurseForge version does not provide a server pack.'
                : 'Modpack download not found.');
        }

        return $this->installableFileService->qualifyUrl($url);
    }

    private function rejectIfAlreadyInstalled(Server $server, array $payload): void {
        $exists = InstalledPlugins::query()
            ->forServer($server)
            ->forInstallContext('/', 'modpack')
            ->where('plugin_service', $payload['plugin_service'])
            ->where('plugin_service_id', $payload['plugin_service_id'])
            ->exists();

        if ($exists) {
            throw new BadRequestHttpException('Modpack already installed.');
        }
    }
}
