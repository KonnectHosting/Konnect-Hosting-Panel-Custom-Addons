<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Pterodactyl\Models\Server;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Throwable;

class ModpackFilesInstallerService
{
    public function __construct(
        private ServerInstallationFilesystemService $filesystem,
        private ModpackRuntimeMetadataResolver      $runtimeMetadataResolver,
    ) {
    }

    public function install(Server $server, array $installable): array {
        return match ($installable['mode'] ?? null) {
            'modrinth-mrpack' => $this->stagedInstall($server, $installable, $this->installModrinthMrpackFiles(...)),
            'merge-archive' => $this->stagedInstall($server, $installable, $this->installMergeArchiveFiles(...)),
            default => throw new UnprocessableEntityHttpException('Unsupported modpack installation mode.'),
        };
    }

    /**
     * Runs an archive install inside a temporary staging directory. The installer
     * performs the mode-specific work and records every path it placed in the
     * target directory in $installedPaths (even on failure) so the catch block
     * can roll back a partially completed install. Returns the install result,
     * optionally including runtime metadata produced by the installer.
     */
    private function stagedInstall(Server $server, array $installable, callable $installer): array {
        $targetDirectory = $installable['target_directory'];
        [$stagingName, $stagingDirectory] = $this->filesystem->createStagingDirectory($server, $targetDirectory);
        $installedPaths = [];

        try {
            $this->filesystem->pullAndExtractArchive($server, $installable, $targetDirectory, $stagingDirectory);

            $serverMetadata = $installer($server, $installable, $stagingName, $stagingDirectory, $installedPaths);

            sort($installedPaths);
            $this->filesystem->chmodManagedFiles($server, $targetDirectory, $installedPaths);

            return $this->installationResult($installedPaths, $serverMetadata);
        } catch (Throwable $exception) {
            $this->filesystem->deleteManagedFiles($server, $targetDirectory, $installedPaths);

            throw $exception;
        } finally {
            $this->filesystem->deleteExistingPathsBestEffort($server, $targetDirectory, [$stagingName]);
        }
    }

    private function installMergeArchiveFiles(Server $server, array $installable, string $stagingName, string $stagingDirectory, array &$installedPaths): ?array {
        $targetDirectory = $installable['target_directory'];
        $archiveFiles = $this->filesystem->listFilesRecursively($server, $stagingDirectory);
        $serverMetadata = $this->curseForgeServerMetadata($server, $stagingDirectory, $archiveFiles);
        $managedPaths = $this->filesystem->stripArchiveWrapper(
            $archiveFiles,
            (bool)($installable['strip_single_top_level_directory'] ?? false),
        );

        if (count($managedPaths) === 0) {
            throw new UnprocessableEntityHttpException('Archive extraction did not produce any managed files.');
        }

        $this->filesystem->failIfTargetFilesExist($server, $targetDirectory, array_values($managedPaths));
        $this->filesystem->moveStagedFiles($server, $targetDirectory, $stagingName, $managedPaths, $installedPaths);

        return $serverMetadata;
    }

    private function installModrinthMrpackFiles(Server $server, array $installable, string $stagingName, string $stagingDirectory, array &$installedPaths): ?array {
        $targetDirectory = $installable['target_directory'];
        $manifest = $this->modrinthManifest($server, $stagingDirectory);
        $overrides = $this->modrinthOverrideMoves($server, $stagingDirectory);
        $overrideTargets = array_values($overrides);
        $downloads = array_values(array_filter(
            $this->modrinthServerDownloads($manifest),
            fn(array $download) => !in_array($download['path'], $overrideTargets, true),
        ));
        $managedPaths = collect($downloads)
            ->pluck('path')
            ->concat($overrideTargets)
            ->sort()
            ->values()
            ->all();

        if (count($managedPaths) === 0) {
            throw new UnprocessableEntityHttpException('Modrinth modpack did not contain any server files to install.');
        }

        $this->filesystem->failIfDuplicateTargets($managedPaths);
        $this->filesystem->failIfTargetFilesExist($server, $targetDirectory, $managedPaths);

        foreach ($downloads as $file) {
            $this->filesystem->ensureParentDirectories($server, $targetDirectory, $file['path']);
            $installedPaths[] = $file['path'];
            $directory = $this->filesystem->joinPath(
                $targetDirectory,
                $this->filesystem->parentDirectory($file['path']),
            );
            $this->filesystem->pull($server, $file['url'], $directory, basename($file['path']));
        }

        $this->filesystem->moveStagedFiles($server, $targetDirectory, $stagingName, $overrides, $installedPaths);

        return $this->runtimeMetadataResolver->fromModrinthManifest($manifest);
    }

    private function installationResult(array $managedPaths, ?array $serverMetadata = null): array {
        $result = ['managed_paths' => $managedPaths];

        if ($serverMetadata !== null) {
            $result['server_metadata'] = $serverMetadata;
        }

        return $result;
    }

    private function modrinthManifest(Server $server, string $stagingDirectory): array {
        $manifest = json_decode(
            $this->filesystem->getContent(
                $server,
                $this->filesystem->joinPath($stagingDirectory, 'modrinth.index.json'),
            ),
            true,
        );

        if (!is_array($manifest) || !isset($manifest['files']) || !is_array($manifest['files'])) {
            throw new UnprocessableEntityHttpException('Modrinth modpack manifest is invalid.');
        }

        return $manifest;
    }

    private function modrinthServerDownloads(array $manifest): array {
        return collect($manifest['files'])
            ->filter(fn($file) => is_array($file) && ($file['env']['server'] ?? 'required') === 'required')
            ->map(function (array $file) {
                if (!is_string($file['path'] ?? null) || !is_string($file['downloads'][0] ?? null)) {
                    throw new UnprocessableEntityHttpException('Modrinth modpack manifest contains an invalid server file.');
                }

                return [
                    'path' => $this->filesystem->safeRelativePath($file['path']),
                    'url' => $file['downloads'][0],
                ];
            })
            ->values()
            ->all();
    }

    private function curseForgeServerMetadata(Server $server, string $stagingDirectory, array $archiveFiles): ?array {
        try {
            $manifest = $this->archiveManifest($server, $stagingDirectory, 'manifest.json', $archiveFiles);
        } catch (Throwable) {
            return null;
        }

        return $this->runtimeMetadataResolver->fromCurseForgeManifest($manifest);
    }

    private function archiveManifest(Server $server, string $stagingDirectory, string $filename, array $archiveFiles): array {
        $candidates = collect($archiveFiles)
            ->filter(fn(string $path) => basename($path) === $filename)
            ->prepend($filename)
            ->unique()
            ->values();

        $manifests = $candidates
            ->map(fn(string $path) => $this->readJsonFile($server, $this->filesystem->joinPath($stagingDirectory, $path)))
            ->filter(fn(?array $manifest) => $manifest !== null)
            ->values();

        if ($manifests->count() !== 1) {
            throw new UnprocessableEntityHttpException("Archive manifest [{$filename}] is missing or ambiguous.");
        }

        return $manifests->first();
    }

    private function readJsonFile(Server $server, string $path): ?array {
        try {
            $decoded = json_decode($this->filesystem->getContent($server, $path), true);
        } catch (Throwable) {
            return null;
        }

        return is_array($decoded) ? $decoded : null;
    }

    private function modrinthOverrideMoves(Server $server, string $stagingDirectory): array {
        // Keyed by install target so server-overrides win when both folders
        // contain the same file; flipped to source => target for the move batch.
        $sourcesByTarget = [];

        foreach ($this->filesystem->listFilesRecursivelyIfExists($server, $this->filesystem->joinPath($stagingDirectory, 'overrides')) as $path) {
            if ($this->isClientOnlyOverridePath($path)) {
                continue;
            }

            $sourcesByTarget[$this->filesystem->safeRelativePath($path)] = $this->filesystem->safeRelativePath('overrides/' . $path);
        }

        foreach ($this->filesystem->listFilesRecursivelyIfExists($server, $this->filesystem->joinPath($stagingDirectory, 'server-overrides')) as $path) {
            $sourcesByTarget[$this->filesystem->safeRelativePath($path)] = $this->filesystem->safeRelativePath('server-overrides/' . $path);
        }

        return array_flip($sourcesByTarget);
    }

    private function isClientOnlyOverridePath(string $path): bool {
        $path = strtolower(str_replace('\\', '/', ltrim($path, '/')));

        return $path === 'options.txt'
            || $path === 'servers.dat'
            || str_starts_with($path, 'resourcepacks/')
            || str_starts_with($path, 'shaderpacks/');
    }
}
