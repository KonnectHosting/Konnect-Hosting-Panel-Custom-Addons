<?php

namespace Pterodactyl\Http\Controllers\Api\Client\PluginsAddon;

use Exception;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Enum\RouteType;
use Pterodactyl\Helpers\ArixAddons;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Models\Permission;
use Pterodactyl\Models\Plugins\InstalledPlugins;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Pterodactyl\Services\ArixAddons\Installers\ModpackInstallationService;
use Pterodactyl\Services\ArixAddons\Installers\PluginInstallableHandler;
use Pterodactyl\Services\ArixAddons\Installers\ServerFilesInstallerService;
use Pterodactyl\Services\ArixAddons\Plugins\InstalledPluginFileSyncService;
use Throwable;

class PluginsController extends ClientApiController
{
    public function __construct(
        private PluginInstallableHandler       $pluginHandler,
        private ServerFilesInstallerService    $filesInstaller,
        private ModpackInstallationService     $modpackInstaller,
        private InstalledPluginFileSyncService $installedPluginFileSyncService,
        private DaemonFileRepository           $fileRepository,
    ) {
        parent::__construct();
    }

    public function index()
    {
        return response()->json([
            'services' => RouteType::fromRequest(request())->catalogServices(),
        ]);
    }

    public function getFilters()
    {
        if (RouteType::fromRequest(request()) === RouteType::WORLDS) {
            return response()->json([
                'versions' => [],
            ]);
        }

        return ArixAddons::licensedRequestToApi('/plugins/filters', [], false, 'GET', 24);
    }

    public function getInstalled($server)
    {
        $request = request();

        if (!$request->user()->can(Permission::ACTION_FILE_READ, $server)) {
            throw new AuthorizationException();
        }

        $routeType = RouteType::fromRequest($request);
        $directoryPath = $routeType->installDirectory();
        $installableType = $routeType->trackingType();

        // The install directory only exists once something was uploaded or
        // installed; fall back to the tracked records when Wings cannot list it.
        $contents = collect();

        if (collect($this->fileRepository->setServer($server)->getDirectory('/'))->isNotEmpty()) {
            try {
                $contents = collect($this->fileRepository->setServer($server)->getDirectory($directoryPath));
            } catch (Exception) {
                $installedPlugins = InstalledPlugins::with('managedFiles')
                    ->forServer($server)
                    ->forInstallContext($directoryPath, $installableType)
                    ->get();

                return response()->json($installedPlugins->values());
            }
        }

        $actualFileNames = $contents->pluck('name')->toArray();
        $installedPlugins = $this->installedPluginFileSyncService->reconcile(
            $server,
            $directoryPath,
            $actualFileNames,
            $installableType,
        );
        $trackedPaths = $installedPlugins
            ->flatMap(fn ($plugin) => $plugin->managed_paths)
            ->unique()
            ->values()
            ->all();

        if ($routeType === RouteType::MODPACKS) {
            return response()->json($installedPlugins->values());
        }

        $untrackedPlugins = $routeType === RouteType::WORLDS
            ? $this->getUntrackedWorlds($server, $contents, $trackedPaths)
            : $contents
                ->filter(fn ($file) => !in_array($file['name'], $trackedPaths, true))
                ->map(fn ($file) => $this->untrackedEntry($server, $file['name'], 'Local file', str_replace('.jar', '', $file['name'])));

        return response()->json($installedPlugins->concat($untrackedPlugins)->values());
    }

    public function getService($server, string $service, ?string $plugin = null)
    {
        $routeType = RouteType::fromRequest(request());

        if (!$routeType->supportsCatalogService($service)) {
            return response()->json([
                'error' => 'Service not found',
            ], 404);
        }

        $queryParameters = request()->only([
            'search', 'license', 'loader', 'version', 'page', 'sortfield', 'sortdirection',
        ]);

        $response = ArixAddons::licensedRequestToApi($routeType->catalogRoute($service, $plugin), $queryParameters, false, 'GET');

        if (!isset($response['meta']) && !isset($response['versions'])) {
            return response()->json([
                'error' => 'Something went wrong fetching the requested items',
            ], 500);
        }

        return $response;
    }

    public function store(Server $server)
    {
        $request = request();
        $routeType = RouteType::fromRequest($request);

        $requiredPermissions = [Permission::ACTION_FILE_CREATE];
        if ($routeType === RouteType::MODPACKS) {
            $requiredPermissions[] = Permission::ACTION_FILE_UPDATE;
            $requiredPermissions[] = Permission::ACTION_FILE_DELETE;
        }

        foreach ($requiredPermissions as $permission) {
            if (!$request->user()->can($permission, $server)) {
                throw new AuthorizationException();
            }
        }

        $request->validate([
            'plugin_service' => 'required|string|max:32',
            'plugin_version' => 'required|string|max:100',
            'plugin_service_id' => 'required|string|max:191',
            'plugin_name' => 'required|string|max:100',
            'plugin_icon' => 'nullable|string|max:255',
        ]);
        $service = $request->plugin_service;

        if (!$routeType->supportsCatalogService($service)) {
            return response()->json([
                'error' => 'Service not found',
            ], 404);
        }

        $payload = [
            'plugin_service' => $request->plugin_service,
            'plugin_version' => $request->plugin_version,
            'plugin_service_id' => $request->plugin_service_id,
            'plugin_name' => $request->plugin_name,
            'plugin_icon' => $request->plugin_icon ?? '',
            'install_directory' => $routeType->installDirectory(),
            'installable_type' => $routeType->trackingType(),
            'catalog_route' => $routeType->catalogRoute($request->plugin_service, $request->plugin_service_id),
        ];

        if ($routeType === RouteType::MODPACKS) {
            return response()->json($this->modpackInstaller->install($server, $payload));
        }

        $installResult = $this->filesInstaller->install($server, $this->pluginHandler->resolve($server, $payload));
        $installedPlugin = $this->pluginHandler->persist($server, $payload, $installResult);

        return response()->json($installedPlugin);
    }

    public function destroy($server, string $plugin_id)
    {
        $request = request();

        if (!$request->user()->can(Permission::ACTION_FILE_DELETE, $server)) {
            throw new AuthorizationException();
        }

        $routeType = RouteType::fromRequest($request);
        $installedPlugin = $this->findInstalledPlugin($server, $plugin_id, $routeType);

        if (!$installedPlugin) {
            return response()->json([
                'error' => 'Item not installed',
            ], 400);
        }

        $this->installedPluginFileSyncService->deleteInstalledPlugin($server, $installedPlugin);

        return response()->json([
            'message' => 'Item uninstalled',
        ]);
    }

    public function rename($server, string $plugin_id): JsonResponse
    {
        $request = request();

        if (!$request->user()->can(Permission::ACTION_FILE_UPDATE, $server)) {
            throw new AuthorizationException();
        }

        $request->validate([
            'plugin_name' => 'string|max:100',
            'file_name' => 'string|max:255',
            'plugin_version' => 'string|max:100',
        ]);

        $routeType = RouteType::fromRequest($request);
        $installedPlugin = $this->findInstalledPlugin($server, $plugin_id, $routeType);

        if (!$installedPlugin) {
            return response()->json([
                'error' => 'Item not installed',
            ], 400);
        }

        $updates = [
            'plugin_name' => $request->plugin_name ?? $installedPlugin->plugin_name,
            'plugin_version' => $request->plugin_version ?? $installedPlugin->plugin_version,
        ];

        if ($installedPlugin->managedFiles->isEmpty()) {
            $updates['file_name'] = $request->file_name ?? $installedPlugin->file_name;
        }

        $installedPlugin->update($updates);

        return response()->json([
            'message' => 'Item renamed',
        ]);
    }

    private function findInstalledPlugin(Server $server, string $pluginId, RouteType $routeType): ?InstalledPlugins
    {
        return InstalledPlugins::with('managedFiles')
            ->forServer($server)
            ->forInstallContext($routeType->installDirectory(), $routeType->trackingType())
            ->whereKey($pluginId)
            ->first();
    }

    private function getUntrackedWorlds(Server $server, $contents, array $trackedPaths)
    {
        return $contents
            ->filter(fn ($file) => !($file['file'] ?? true))
            ->filter(fn ($file) => !in_array($file['name'], $trackedPaths, true))
            ->filter(fn ($file) => $this->directoryContainsLevelDat($server, $file['name']))
            ->map(fn ($file) => $this->untrackedEntry($server, $file['name'], 'Local world'));
    }

    private function untrackedEntry(Server $server, string $fileName, string $versionLabel, ?string $displayName = null): array
    {
        return [
            'id' => null,
            'plugin_service' => 'unknown',
            'plugin_version' => $versionLabel,
            'plugin_service_id' => 'unknown',
            'plugin_name' => $displayName ?? $fileName,
            'plugin_icon' => 'local',
            'server_id' => $server->id,
            'file_name' => $fileName,
            'managed_paths' => [$fileName],
        ];
    }

    private function directoryContainsLevelDat(Server $server, string $directory): bool
    {
        try {
            return collect($this->fileRepository->setServer($server)->getDirectory('/' . ltrim($directory, '/')))
                ->contains(fn ($item) => ($item['name'] ?? null) === 'level.dat');
        } catch (Throwable) {
            return false;
        }
    }
}
