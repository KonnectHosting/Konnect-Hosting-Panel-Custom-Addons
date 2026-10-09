<?php

namespace Pterodactyl\Enum;

use Illuminate\Http\Request;

enum RouteType
{
    case PLUGINS;
    case MODS;
    case MODPACKS;
    case HYTALE_MODS;
    case WORLDS;

    public static function fromRequest(Request $request): self
    {
        return self::fromRoute($request->route()?->uri() ?? '');
    }

    public static function fromRoute(string $route): self
    {
        if (str_contains($route, '/worlds')) {
            return self::WORLDS;
        }

        if (str_contains($route, '/hytale/mods')) {
            return self::HYTALE_MODS;
        }

        if (str_contains($route, '/modpacks')) {
            return self::MODPACKS;
        }

        if (str_contains($route, '/mods')) {
            return self::MODS;
        }

        return self::PLUGINS;
    }

    public function installDirectory(): string
    {
        return match ($this) {
            self::PLUGINS => '/plugins',
            self::MODS, self::HYTALE_MODS => '/mods',
            self::MODPACKS => '/',
            self::WORLDS => '/',
        };
    }

    public function catalogRoute(string $service, ?string $plugin = null): string
    {
        $prefix = match ($this) {
            self::PLUGINS => 'plugins',
            self::MODS => 'mods',
            self::MODPACKS => 'modpacks',
            self::HYTALE_MODS => 'hytale/mods',
            self::WORLDS => 'worlds',
        };

        return $prefix . '/' . rawurlencode($service) . ($plugin !== null ? '/' . rawurlencode($plugin) : '');
    }

    public function catalogServices(): array
    {
        return match ($this) {
            self::PLUGINS => ['spigot', 'curseforge', 'modrinth', 'hangar'],
            self::MODS, self::MODPACKS => ['curseforge', 'modrinth'],
            self::HYTALE_MODS, self::WORLDS => ['curseforge'],
        };
    }

    public function supportsCatalogService(string $service): bool
    {
        return in_array($service, $this->catalogServices(), true);
    }

    public function trackingType(): string
    {
        return match ($this) {
            self::PLUGINS => 'plugin',
            self::MODS => 'mod',
            self::MODPACKS => 'modpack',
            self::HYTALE_MODS => 'mod',
            self::WORLDS => 'world',
        };
    }
}
