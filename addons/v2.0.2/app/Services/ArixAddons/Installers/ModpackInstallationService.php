<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Pterodactyl\Models\Plugins\InstalledPlugins;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonServerRepository;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Throwable;

class ModpackInstallationService
{
    public function __construct(
        private ModpackInstallableHandler   $modpackHandler,
        private VersionInstallableHandler   $versionHandler,
        private ServerFilesInstallerService $filesInstaller,
        private VersionChangePolicy         $versionChangePolicy,
        private DaemonServerRepository      $serverRepository,
    ) {
    }

    public function install(Server $server, array $payload): InstalledPlugins {
        $details = $this->serverRepository->setServer($server)->getDetails();
        if (($details['state'] ?? null) !== 'offline') {
            throw new ConflictHttpException('The server must be offline before installing a modpack.');
        }

        $installable = $this->modpackHandler->resolve($server, $payload);
        $modpackResult = null;

        try {
            $modpackResult = $this->filesInstaller->install($server, $installable);
            $metadata = $modpackResult['server_metadata'] ?? null;

            if (is_array($metadata) && $this->versionChangePolicy->allows($server, $metadata['platform'])) {
                $versionPayload = [
                    'service' => $metadata['platform'],
                    'version' => $metadata['version'],
                ];
                if (is_string($metadata['loader_build'] ?? null)) {
                    $versionPayload['loader_build'] = $metadata['loader_build'];
                }

                $this->installVersion($server, $versionPayload);
            }

            return $this->modpackHandler->persist($server, $payload, $modpackResult);
        } catch (Throwable $exception) {
            if (is_array($modpackResult)) {
                $this->filesInstaller->removeManagedFiles(
                    $server,
                    $installable['target_directory'],
                    $modpackResult['managed_paths'] ?? [],
                );
            }

            throw $exception;
        }
    }

    private function installVersion(Server $server, array $payload): Server {
        $installable = $this->versionHandler->resolve($payload);
        $this->filesInstaller->install($server, $installable);

        return $this->versionHandler->persist($server, $payload);
    }
}
