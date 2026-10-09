<?php

namespace Pterodactyl\Services\ArixAddons\Plugins;

use Illuminate\Database\DatabaseManager;
use Pterodactyl\Models\Plugins\InstalledPluginPath;
use Pterodactyl\Models\Plugins\InstalledPlugins;
use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use Throwable;

class InstalledPluginFileSyncService
{
    public function __construct(
        private DatabaseManager      $database,
        private DaemonFileRepository $fileRepository,
    ) {
    }

    public function reconcile(Server $server, string $directory, array $actualPaths, ?string $installableType = null)
    {
        $actualPaths = array_values(array_unique($actualPaths));
        sort($actualPaths);

        $plugins = InstalledPlugins::with('managedFiles')
            ->forServer($server)
            ->forInstallContext($directory, $installableType)
            ->get();

        foreach ($plugins as $plugin) {
            $existingPaths = $directory === '/'
                ? $this->existingManagedPaths($server, $plugin->managed_paths)
                : array_values(array_intersect($plugin->managed_paths, $actualPaths));

            // A failed Wings request does not prove that the files are gone. Leave the
            // tracking record untouched and try again during the next reconciliation.
            if ($existingPaths === null) {
                continue;
            }

            if (count($existingPaths) === 0) {
                $plugin->delete();
                continue;
            }

            if ($plugin->isDirty()) {
                $plugin->save();
            }

            $this->syncManagedPaths($plugin, $existingPaths);
        }

        return InstalledPlugins::with('managedFiles')
            ->forServer($server)
            ->forInstallContext($directory, $installableType)
            ->get();
    }

    public function syncRenames(Server $server, string $directory, array $files): void
    {
        if (!in_array($directory, ['/plugins', '/mods'], true) || count($files) === 0) {
            return;
        }

        $renameMap = collect($files)
            ->filter(fn ($file) => isset($file['from'], $file['to']))
            ->mapWithKeys(fn ($file) => [$file['from'] => $file['to']])
            ->all();

        if (count($renameMap) === 0) {
            return;
        }

        $plugins = InstalledPlugins::with('managedFiles')
            ->forServer($server)
            ->where('install_directory', $directory)
            ->get();

        foreach ($plugins as $plugin) {
            $updatedPaths = array_map(
                fn (string $path) => $renameMap[$path] ?? $path,
                $plugin->managed_paths
            );

            if ($updatedPaths === $plugin->managed_paths) {
                continue;
            }

            $this->syncManagedPaths($plugin, $updatedPaths);
        }
    }

    public function deleteInstalledPlugin(Server $server, InstalledPlugins $plugin): void
    {
        $managedPaths = $plugin->managed_paths;
        $directory = $plugin->install_directory;

        if (count($managedPaths) > 0) {
            $this->fileRepository
                ->setServer($server)
                ->deleteFiles($directory, $managedPaths);
        }

        $plugin->delete();
    }

    private function syncManagedPaths(InstalledPlugins $plugin, array $paths): void
    {
        $paths = array_values(array_unique(array_filter($paths)));
        sort($paths);

        $this->database->transaction(function () use ($plugin, $paths) {
            InstalledPluginPath::where('installed_plugin_id', $plugin->id)
                ->whereNotIn('path', $paths)
                ->delete();

            $existingPaths = InstalledPluginPath::where('installed_plugin_id', $plugin->id)
                ->pluck('path')
                ->all();

            foreach (array_diff($paths, $existingPaths) as $path) {
                InstalledPluginPath::create([
                    'installed_plugin_id' => $plugin->id,
                    'path' => $path,
                ]);
            }

            $plugin->forceFill([
                'file_name' => $paths[0] ?? $plugin->file_name,
            ])->save();
        });

        $plugin->load('managedFiles');
    }

    /**
     * @return array<string>|null Null when Wings could not confirm the current state.
     */
    private function existingManagedPaths(Server $server, array $managedPaths): ?array
    {
        $pathsByDirectory = collect($managedPaths)
            ->map(fn (string $path) => trim($path, '/'))
            ->filter()
            ->groupBy(fn (string $path) => dirname($path) === '.' ? '/' : '/' . dirname($path));

        $existingPaths = collect();

        foreach ($pathsByDirectory as $directory => $paths) {
            try {
                $actualNames = collect($this->fileRepository->setServer($server)->getDirectory($directory))
                    ->pluck('name')
                    ->filter(fn ($name) => is_string($name) && $name !== '')
                    ->all();
            } catch (Throwable $exception) {
                return null;
            }

            $existingPaths->push(
                ...$paths->filter(fn (string $path) => in_array(basename($path), $actualNames, true))
            );
        }

        return $existingPaths
            ->values()
            ->all();
    }
}
