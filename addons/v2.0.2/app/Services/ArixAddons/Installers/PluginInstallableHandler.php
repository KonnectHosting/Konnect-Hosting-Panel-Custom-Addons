<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Illuminate\Database\DatabaseManager;
use Pterodactyl\Helpers\ArixAddons;
use Pterodactyl\Models\Plugins\InstalledPluginPath;
use Pterodactyl\Models\Plugins\InstalledPlugins;
use Pterodactyl\Models\Server;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PluginInstallableHandler
{
    public function __construct(
        private DatabaseManager        $database,
        private InstallableFileService $installableFileService,
    ) {
    }

    public function resolve(Server $server, array $payload): array {
        $service = $payload['plugin_service'];
        $pluginId = $payload['plugin_service_id'];
        $pluginVersion = $payload['plugin_version'];
        $directory = $payload['install_directory'];

        $existingPlugin = InstalledPlugins::query()
            ->forServer($server)
            ->where('plugin_service', $service)
            ->where('plugin_service_id', $pluginId)
            ->forInstallContext($directory, $payload['installable_type'] ?? null)
            ->first();

        if ($existingPlugin) {
            throw new BadRequestHttpException('Plugin already installed.');
        }

        $route = $payload['catalog_route'] ?? "plugins/{$service}/{$pluginId}";
        $selectedVersion = $this->selectVersion($route, $pluginVersion);

        if (!is_string($selectedVersion['url'] ?? null) || $selectedVersion['url'] === '') {
            throw new NotFoundHttpException('Plugin version not found.');
        }

        $downloadUrl = $this->resolveDownloadUrl(
            service: $service,
            selectedVersion: $selectedVersion,
            pluginName: $payload['plugin_name'],
            pluginVersion: $pluginVersion,
        );

        $extension = $this->installableFileService->extensionFromUrl($downloadUrl) ?: 'jar';

        return [
            'download_url' => $downloadUrl,
            'target_directory' => $directory,
            'target_filename' => $this->installableFileService->buildFilename($payload['plugin_name'], $pluginVersion, $extension, 'plugin-install'),
            'allow_overwrite' => false,
            'delete_before_extraction' => [],
        ];
    }

    /**
     * Fetches the catalog entry and selects the named version, preferring the
     * newest occurrence when the catalog lists a version more than once.
     */
    public function selectVersion(string $catalogRoute, string $pluginVersion, string $label = 'Plugin'): array {
        $response = ArixAddons::licensedRequestToApi($catalogRoute, [], false, 'GET');

        if (!isset($response['versions']) || !is_array($response['versions'])) {
            throw new NotFoundHttpException("{$label} fetch failed.");
        }

        $selectedVersion = collect(array_reverse($response['versions']))->firstWhere('name', $pluginVersion);

        if (!is_array($selectedVersion)) {
            throw new NotFoundHttpException("{$label} version not found.");
        }

        return $selectedVersion;
    }

    public function persist(Server $server, array $payload, array $result): InstalledPlugins {
        return $this->database->transaction(function () use ($server, $payload, $result) {
            $plugin = InstalledPlugins::create([
                'plugin_service' => $payload['plugin_service'],
                'plugin_version' => $payload['plugin_version'],
                'plugin_service_id' => $payload['plugin_service_id'],
                'plugin_name' => $payload['plugin_name'],
                'plugin_icon' => $payload['plugin_icon'] ?? '',
                'server_id' => $server->id,
                'file_name' => $result['managed_paths'][0],
                'install_directory' => $payload['install_directory'],
                'installable_type' => $payload['installable_type'],
            ]);

            foreach ($result['managed_paths'] as $path) {
                InstalledPluginPath::create([
                    'installed_plugin_id' => $plugin->id,
                    'path' => $path,
                ]);
            }

            return $plugin->load('managedFiles');
        });
    }

    private function resolveDownloadUrl(string $service, array $selectedVersion, string $pluginName, string $pluginVersion): string {
        if ($service !== 'spigot') {
            return $this->installableFileService->qualifyUrl($selectedVersion['url']);
        }

        $prepared = ArixAddons::licensedRequestToApi('file/prepare', [
            'url' => $selectedVersion['url'],
            'name' => $this->installableFileService->sanitizeSegment($pluginName) . '.jar',
            'version' => $this->installableFileService->sanitizeSegment($pluginVersion),
        ], true, 'POST');

        if (!isset($prepared['url']) || !is_string($prepared['url'])) {
            throw new BadRequestHttpException('Failed to prepare the plugin download.');
        }

        return $this->installableFileService->qualifyUrl($prepared['url']);
    }
}
