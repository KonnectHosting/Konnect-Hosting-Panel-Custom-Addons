<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

class ModpackRuntimeMetadataResolver
{
    private const LOADER_ALIASES = [
        'Fabric' => ['fabric-loader', 'fabric'],
        'Forge' => ['forge'],
        'NeoForge' => ['neoforge', 'neo-forge'],
    ];

    private const UNSUPPORTED_LOADERS = [
        'quilt-loader',
        'quilt',
        'legacyfabric',
        'rift',
    ];

    public function fromModrinthManifest(array $manifest): ?array {
        $dependencies = $manifest['dependencies'] ?? null;
        if (!is_array($dependencies)) {
            return null;
        }

        $loaders = [];
        foreach ($dependencies as $dependency => $loaderBuild) {
            if (!is_string($dependency)) {
                continue;
            }

            [$platform, $loaderLike] = $this->loaderPlatform($dependency);
            if ($loaderLike && $platform === null) {
                return null;
            }
            if ($platform !== null) {
                $loaders[] = [
                    'platform' => $platform,
                    'build' => is_string($loaderBuild) ? $loaderBuild : null,
                ];
            }
        }

        return $this->serverMetadata($dependencies['minecraft'] ?? null, $loaders);
    }

    public function fromCurseForgeManifest(array $manifest): ?array {
        if (!is_array($manifest['minecraft'] ?? null)) {
            return null;
        }

        $minecraft = $manifest['minecraft'];
        $modLoaders = $minecraft['modLoaders'] ?? [];
        if (!is_array($modLoaders)) {
            return null;
        }

        $loaders = [];
        foreach ($modLoaders as $loader) {
            if (!is_array($loader) || !is_string($loader['id'] ?? null)) {
                return null;
            }

            [$platform, $loaderBuild, $loaderLike] = $this->curseForgeLoader($loader['id']);
            if ($loaderLike && $platform === null) {
                return null;
            }
            if ($platform !== null) {
                $loaders[] = [
                    'platform' => $platform,
                    'build' => $loaderBuild,
                ];
            }
        }

        return $this->serverMetadata($minecraft['version'] ?? null, $loaders);
    }

    private function serverMetadata(mixed $minecraftVersion, array $loaders): ?array {
        if (!is_string($minecraftVersion) || !preg_match('/^[0-9A-Za-z._+-]+$/', $minecraftVersion) || count($loaders) !== 1) {
            return null;
        }

        $loader = $loaders[0];
        if (!isset($loader['platform']) || !is_string($loader['platform'])) {
            return null;
        }

        $platform = strtolower($loader['platform']);
        if (!in_array($platform, ['fabric', 'forge', 'neoforge'], true)) {
            return null;
        }

        $loaderBuild = $loader['build'] ?? null;
        if (!is_string($loaderBuild) || $loaderBuild === '' || !preg_match('/^[0-9A-Za-z][0-9A-Za-z._+-]*$/', $loaderBuild)) {
            $loaderBuild = null;
        }

        return [
            'platform' => $loader['platform'],
            'version' => $minecraftVersion,
            'loader_build' => $loaderBuild,
        ];
    }

    private function loaderPlatform(string $loader): array {
        $loader = strtolower(trim($loader));

        foreach (self::LOADER_ALIASES as $platform => $aliases) {
            if (in_array($loader, $aliases, true)) {
                return [$platform, true];
            }
        }

        return [
            null,
            in_array($loader, self::UNSUPPORTED_LOADERS, true) || str_contains($loader, 'loader'),
        ];
    }

    private function curseForgeLoader(string $loader): array {
        $loader = strtolower(trim($loader));

        foreach (self::LOADER_ALIASES as $platform => $aliases) {
            foreach ($aliases as $alias) {
                $prefix = $alias . '-';
                if (str_starts_with($loader, $prefix)) {
                    return [$platform, substr($loader, strlen($prefix)), true];
                }
            }
        }

        foreach (self::UNSUPPORTED_LOADERS as $unsupportedLoader) {
            if (str_starts_with($loader, $unsupportedLoader . '-')) {
                return [null, null, true];
            }
        }

        [$platform, $loaderLike] = $this->loaderPlatform($loader);

        return [$platform, null, $loaderLike || str_contains($loader, 'forge')];
    }
}
