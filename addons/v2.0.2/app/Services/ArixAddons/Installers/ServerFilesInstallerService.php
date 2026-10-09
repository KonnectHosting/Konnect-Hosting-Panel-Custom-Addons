<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Pterodactyl\Models\Server;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Throwable;

class ServerFilesInstallerService
{
    public function __construct(
        private ServerInstallationFilesystemService $filesystem,
        private ModpackFilesInstallerService        $modpackInstaller,
    ) {
    }

    public function install(Server $server, array $installable): array {
        return match ($installable['mode'] ?? null) {
            'modrinth-mrpack', 'merge-archive' => $this->modpackInstaller->install($server, $installable),
            null => $this->installDefault($server, $installable),
            default => throw new UnprocessableEntityHttpException('Unsupported installation mode.'),
        };
    }

    /**
     * Best-effort cleanup for a completed install whose enclosing operation
     * subsequently failed, such as a modpack whose required jar switch failed.
     */
    public function removeManagedFiles(Server $server, string $directory, array $paths): void {
        $this->filesystem->deleteManagedFiles($server, $directory, $paths);
    }

    private function installDefault(Server $server, array $installable): array {
        if ($installable['allow_overwrite']) {
            $this->filesystem->deleteExistingPaths($server, $installable['target_directory'], [$installable['target_filename']]);
        }

        if (strtolower(pathinfo($installable['target_filename'], PATHINFO_EXTENSION)) === 'zip') {
            return $this->installArchive($server, $installable);
        }

        try {
            $this->filesystem->pull(
                $server,
                $installable['download_url'],
                $installable['target_directory'],
                $installable['target_filename'],
            );
        } catch (Throwable $exception) {
            if ($installable['allow_overwrite']) {
                $this->filesystem->deleteManagedFiles($server, $installable['target_directory'], [$installable['target_filename']]);
            }

            throw $exception;
        }

        return ['managed_paths' => [$installable['target_filename']]];
    }

    private function installArchive(Server $server, array $installable): array {
        $targetDirectory = $installable['target_directory'];
        [$stagingName, $stagingDirectory] = $this->filesystem->createStagingDirectory($server, $targetDirectory);

        try {
            $this->filesystem->pullAndExtractArchive($server, $installable, $targetDirectory, $stagingDirectory);

            $managedPaths = $this->filesystem->listPathNames($server, $stagingDirectory)->values();

            if ($managedPaths->isEmpty()) {
                throw new UnprocessableEntityHttpException('Archive extraction did not produce any top-level managed paths.');
            }

            $conflictingPaths = $this->filesystem->listPathNames($server, $targetDirectory)
                ->reject(fn(string $path) => $path === $stagingName)
                ->intersect($managedPaths)
                ->values()
                ->all();

            if (count($conflictingPaths) > 0) {
                throw new ConflictHttpException('Archive extraction would overwrite existing paths: ' . implode(', ', $conflictingPaths));
            }

            $this->filesystem->moveTopLevelPaths($server, $targetDirectory, $stagingName, $managedPaths->all());
            $this->filesystem->chmodManagedFiles($server, $targetDirectory, $managedPaths->all());

            return ['managed_paths' => $managedPaths->all()];
        } finally {
            $this->filesystem->deleteExistingPathsBestEffort($server, $targetDirectory, [$stagingName]);
        }
    }
}
