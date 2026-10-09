<?php

namespace Pterodactyl\Http\Controllers\Api\Client\VersionsAddon;

use Illuminate\Http\JsonResponse;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\VersionsAddon\ChangeVersionRequest;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonServerRepository;
use Pterodactyl\Services\ArixAddons\Installers\ServerFilesInstallerService;
use Pterodactyl\Services\ArixAddons\Installers\VersionChangePolicy;
use Pterodactyl\Services\ArixAddons\Installers\VersionCatalogService;
use Pterodactyl\Services\ArixAddons\Installers\VersionInstallableHandler;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class VersionsController extends ClientApiController
{
    public function __construct(
        private VersionInstallableHandler   $versionHandler,
        private ServerFilesInstallerService $filesInstaller,
        private VersionChangePolicy         $versionChangePolicy,
        private VersionCatalogService       $versionCatalog,
        private DaemonServerRepository      $serverRepository,
    ) {
        parent::__construct();
    }

    public function getServices(Server $server, ?string $service = null): JsonResponse
    {
        if ($service !== null && !$this->versionChangePolicy->allows($server, $service)) {
            return response()->json([
                'status' => 'error',
                'message' => 'This egg is not allowed to use this service.',
            ], 403);
        }

        $response = $service === null
            ? $this->versionCatalog->getServices()
            : $this->versionCatalog->getVersions($service);

        if (!$response || count($response) === 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'No versions found.',
            ], 404);
        }

        if ($service === null) {
            $response = $this->versionChangePolicy->filterAllowed($server, $response);
        }

        $parts = $server->mc_version ? explode('|', $server->mc_version, 2) : [];

        $currentVersion = count($parts) === 2
            ? ['service' => $parts[0], 'version' => $parts[1]]
            : ['service' => '', 'version' => ''];

        return response()->json([
            'status' => 'success',
            'data' => $response,
            'current' => $currentVersion,
        ]);
    }

    public function store(ChangeVersionRequest $request, Server $server, string $service, string $version): JsonResponse
    {
        if (!$this->versionChangePolicy->allows($server, $service)) {
            return response()->json([
                'status' => 'error',
                'message' => 'This egg is not allowed to use this service.',
            ], 403);
        }

        $details = $this->serverRepository->setServer($server)->getDetails();
        if (($details['state'] ?? null) !== 'offline') {
            throw new ConflictHttpException('The server must be offline before changing its runtime.');
        }

        $payload = [
            'service' => $service,
            'version' => $version,
        ];
        $buildId = $request->validated('build_id');
        if (is_string($buildId) && $buildId !== '') {
            $payload['build_id'] = $buildId;
        }

        $installable = $this->versionHandler->resolve($payload);
        $this->filesInstaller->install($server, $installable);
        $this->versionHandler->persist($server, $payload);

        return response()->json([
            'status' => 'success',
            'message' => 'Version updated successfully.',
        ]);
    }
}
