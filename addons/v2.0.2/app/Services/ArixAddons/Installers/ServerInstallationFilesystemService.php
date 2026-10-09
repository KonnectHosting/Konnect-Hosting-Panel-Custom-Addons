<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Throwable;

class ServerInstallationFilesystemService
{
    public function __construct(private DaemonFileRepository $fileRepository) {
    }

    public function pull(Server $server, string $url, string $directory, string $filename): void {
        $this->fileRepository
            ->setServer($server)
            ->pull($url, $directory, [
                'filename' => $filename,
                'foreground' => true,
            ]);
    }

    public function getContent(Server $server, string $path): string {
        return $this->fileRepository
            ->setServer($server)
            ->getContent($path, 1024 * 1024);
    }

    public function createStagingDirectory(Server $server, string $targetDirectory): array {
        $stagingName = '.plugin-install-' . Str::uuid()->toString();
        $stagingDirectory = $this->joinPath($targetDirectory, $stagingName);

        $this->fileRepository
            ->setServer($server)
            ->createDirectory($stagingName, $targetDirectory);

        return [$stagingName, $stagingDirectory];
    }

    public function pullAndExtractArchive(
        Server $server,
        array  $installable,
        string $targetDirectory,
        string $stagingDirectory,
    ): void {
        $archiveFilename = $installable['target_filename'];
        $extractableFilename = $this->extractableArchiveFilename($archiveFilename);

        $this->pull($server, $installable['download_url'], $stagingDirectory, $archiveFilename);

        if ($extractableFilename !== $archiveFilename) {
            $this->fileRepository
                ->setServer($server)
                ->renameFiles($stagingDirectory, [[
                    'from' => $archiveFilename,
                    'to' => $extractableFilename,
                ]]);
        }

        $this->deleteExistingPaths($server, $targetDirectory, $installable['delete_before_extraction'] ?? []);

        $this->fileRepository
            ->setServer($server)
            ->decompressFile($stagingDirectory, $extractableFilename);

        $this->deleteExistingPaths($server, $stagingDirectory, [$extractableFilename]);
    }

    public function moveTopLevelPaths(Server $server, string $targetDirectory, string $stagingName, array $paths): void {
        $this->fileRepository
            ->setServer($server)
            ->renameFiles($targetDirectory, collect($paths)
                ->map(fn(string $path) => [
                    'from' => ltrim($this->joinPath($stagingName, $path), '/'),
                    'to' => $path,
                ])
                ->all());
    }

    public function moveStagedFiles(
        Server $server,
        string $targetDirectory,
        string $stagingName,
        array  $moves,
        array  &$installedPaths,
    ): void {
        if (count($moves) === 0) {
            return;
        }

        foreach ($moves as $to) {
            $this->ensureParentDirectories($server, $targetDirectory, $to);
        }

        // Record every possible target before the batch operation so a partial
        // Wings failure can still remove anything that was already moved.
        $installedPaths = array_merge($installedPaths, array_values($moves));

        $this->fileRepository
            ->setServer($server)
            ->renameFiles($targetDirectory, collect($moves)
                ->map(fn(string $to, string $from) => [
                    'from' => ltrim($this->joinPath($stagingName, $from), '/'),
                    'to' => $to,
                ])
                ->values()
                ->all());
    }

    public function joinPath(string $directory, string $path): string {
        return rtrim($directory, '/') . '/' . ltrim($path, '/');
    }

    public function safeRelativePath(string $path): string {
        $path = str_replace('\\', '/', trim($path));

        if ($path === ''
            || str_starts_with($path, '/')
            || preg_match('/^[A-Za-z]:\//', $path)
            || preg_match('#(^|/)\.\.?(/|$)#', $path)
        ) {
            throw new UnprocessableEntityHttpException('Installable contains an unsafe path.');
        }

        return $path;
    }

    public function parentDirectory(string $path): string {
        $parent = dirname($path);

        return $parent === '.' ? '/' : $parent;
    }

    public function ensureParentDirectories(Server $server, string $targetDirectory, string $path): void {
        $parent = trim($this->parentDirectory($path), '/');

        if ($parent === '') {
            return;
        }

        $current = trim($targetDirectory, '/') === '' ? '/' : $targetDirectory;

        foreach (explode('/', $parent) as $segment) {
            $existing = $this->directoryEntry($server, $current, $segment);

            if ($existing !== null && !($existing['file'] ?? false)) {
                $current = $this->joinPath($current, $segment);
                continue;
            }

            if ($existing !== null) {
                throw new ConflictHttpException("Cannot create directory [{$segment}] because a file already exists at that path.");
            }

            $this->fileRepository
                ->setServer($server)
                ->createDirectory($segment, $current);

            $current = $this->joinPath($current, $segment);
        }
    }

    public function failIfTargetFilesExist(Server $server, string $targetDirectory, array $paths): void {
        $conflicts = collect($paths)
            ->filter(fn(string $path) => $this->targetFileExists($server, $targetDirectory, $path))
            ->values()
            ->all();

        if (count($conflicts) > 0) {
            throw new ConflictHttpException('Install would overwrite existing files: ' . implode(', ', $conflicts));
        }
    }

    public function failIfDuplicateTargets(array $paths): void {
        $duplicates = collect($paths)
            ->duplicates()
            ->values()
            ->all();

        if (count($duplicates) > 0) {
            throw new UnprocessableEntityHttpException('Install contains duplicate target files: ' . implode(', ', $duplicates));
        }
    }

    public function listFilesRecursively(Server $server, string $directory): array {
        $files = [];
        $this->collectFilesRecursively($server, $directory, '', $files);
        sort($files);

        return $files;
    }

    public function listFilesRecursivelyIfExists(Server $server, string $directory): array {
        try {
            return $this->listFilesRecursively($server, $directory);
        } catch (Throwable) {
            return [];
        }
    }

    public function stripArchiveWrapper(array $files, bool $stripSingleTopLevelDirectory): array {
        if (count($files) === 0) {
            return [];
        }

        if (!$stripSingleTopLevelDirectory) {
            return array_combine($files, $files);
        }

        $topLevel = collect($files)
            ->map(fn(string $path) => str_contains($path, '/') ? Str::before($path, '/') : null)
            ->unique()
            ->values();

        if ($topLevel->count() !== 1 || $topLevel[0] === null) {
            return array_combine($files, $files);
        }

        $wrapper = $topLevel[0] . '/';

        return collect($files)
            ->mapWithKeys(fn(string $path) => [$path => $this->safeRelativePath(Str::after($path, $wrapper))])
            ->all();
    }

    public function deleteExistingPaths(Server $server, string $directory, array $paths): void {
        $existingPaths = $this->listPathNames($server, $directory)
            ->intersect($paths)
            ->values()
            ->all();

        if (count($existingPaths) === 0) {
            return;
        }

        $this->fileRepository
            ->setServer($server)
            ->deleteFiles($directory, $existingPaths);
    }

    public function deleteExistingPathsBestEffort(Server $server, string $directory, array $paths): void {
        try {
            $this->deleteExistingPaths($server, $directory, $paths);
        } catch (Throwable) {
            // Staging cleanup must not turn a completed install into a failure.
        }
    }

    public function deleteManagedFiles(Server $server, string $directory, array $paths): void {
        $paths = array_values(array_filter($paths));

        if (count($paths) === 0) {
            return;
        }

        try {
            $this->fileRepository
                ->setServer($server)
                ->deleteFiles($directory, $paths);
        } catch (Throwable) {
            // Best-effort rollback only; preserve the original install failure.
        }
    }

    public function chmodManagedFiles(Server $server, string $directory, array $paths): void {
        $files = collect();
        $pathsByDirectory = collect($paths)
            ->filter()
            ->groupBy(fn(string $path) => $this->joinPath($directory, $this->parentDirectory($path)));

        foreach ($pathsByDirectory as $parentDirectory => $directoryPaths) {
            $actualFiles = collect($this->fileRepository->setServer($server)->getDirectory($parentDirectory))
                ->filter(fn($item) => is_array($item) && ($item['file'] ?? false))
                ->pluck('name')
                ->all();

            foreach ($directoryPaths as $path) {
                if (in_array(basename($path), $actualFiles, true)) {
                    $files->push([
                        'file' => $path,
                        'mode' => '644',
                    ]);
                }
            }
        }

        if (count($files) === 0) {
            return;
        }

        $this->fileRepository
            ->setServer($server)
            ->chmodFiles($directory, $files->values()->all());
    }

    public function listPathNames(Server $server, string $directory): Collection {
        return collect($this->fileRepository->setServer($server)->getDirectory($directory))
            ->pluck('name')
            ->filter(fn($path) => is_string($path) && $path !== '')
            ->sort()
            ->values();
    }

    private function collectFilesRecursively(Server $server, string $directory, string $prefix, array &$files): void {
        foreach ($this->fileRepository->setServer($server)->getDirectory($directory) as $item) {
            $name = $item['name'] ?? null;

            if (!is_string($name) || $name === '') {
                continue;
            }

            $relativePath = ltrim($prefix . '/' . $name, '/');

            if ($item['file'] ?? false) {
                $files[] = $this->safeRelativePath($relativePath);
                continue;
            }

            $this->collectFilesRecursively($server, $this->joinPath($directory, $name), $relativePath, $files);
        }
    }

    private function targetFileExists(Server $server, string $targetDirectory, string $path): bool {
        $parent = trim($this->parentDirectory($path), '/');
        $directory = trim($targetDirectory, '/') === '' ? '/' : $targetDirectory;

        if ($parent !== '') {
            foreach (explode('/', $parent) as $segment) {
                $existing = $this->directoryEntry($server, $directory, $segment);

                if ($existing === null) {
                    return false;
                }

                if ($existing['file'] ?? false) {
                    return true;
                }

                $directory = $this->joinPath($directory, $segment);
            }
        }

        return $this->directoryEntry($server, $directory, basename($path)) !== null;
    }

    private function directoryEntry(Server $server, string $directory, string $name): ?array {
        $entry = collect($this->fileRepository->setServer($server)->getDirectory($directory))
            ->first(fn($item) => ($item['name'] ?? null) === $name);

        return is_array($entry) ? $entry : null;
    }

    private function extractableArchiveFilename(string $filename): string {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        // zip files with diff names
        $aliases = [
            'mcaddon' => 'zip',
            'mcpack' => 'zip',
            'mcworld' => 'zip',
            'mrpack' => 'zip',
        ];

        if (!isset($aliases[$extension])) {
            return $filename;
        }

        return preg_replace('/\.[^.]+$/', '.' . $aliases[$extension], $filename) ?? ($filename . '.' . $aliases[$extension]);
    }
}
