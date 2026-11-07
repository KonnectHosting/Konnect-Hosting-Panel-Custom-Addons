<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

final class ScanScope
{
    public const VERSION = 'targeted-v1';
    public const CODE = ['/garrysmod/lua', '/garrysmod/addons', '/garrysmod/gamemodes',
        '/garrysmod/data', '/garrysmod/cfg', '/garrysmod/materials'];
    public const ARCHIVES = ['/garrysmod/cache/srcds', '/garrysmod/cache/workshop',
        '/steamapps/workshop/content/4000', '/steam_cache'];
    private const ASSETS = ['maps', 'models', 'sound', 'particles', 'resource', 'screenshots', 'assets'];

    public static function roots(bool $archives): array { return $archives ? [...self::CODE, ...self::ARCHIVES] : self::CODE; }

    public static function directory(string $path, bool $archives = true): bool
    {
        if (!ScannerSource::path($path)) { return false; }
        $parts = explode('/', $path);
        if (array_intersect($parts, ['.git', 'node_modules'])) { return false; }
        foreach (self::CODE as $root) {
            if ($path === $root) { return true; }
            if (!str_starts_with($path, $root . '/')) { continue; }
            $relative = explode('/', substr($path, strlen($root) + 1));
            // Keep Lua directories named "models" etc. Only exclude actual
            // top-level game-asset trees in unpacked addons/gamemodes.
            return !in_array($root, ['/garrysmod/addons', '/garrysmod/gamemodes'], true)
                || !isset($relative[1]) || !in_array(strtolower($relative[1]), self::ASSETS, true);
        }
        if ($archives) {
            foreach (self::ARCHIVES as $root) {
                if ($path === $root) { return true; }
                if (!str_starts_with($path, $root . '/')) { continue; }
                $relative = substr($path, strlen($root) + 1);
                if ($root === '/steam_cache') {
                    // Some eggs use steam_cache for a full game installation.
                    // Visit only known Workshop layouts and numeric item IDs.
                    return (bool) preg_match('#^(?:[0-9]+(?:/[0-9]+)*|content(?:/4000(?:/[0-9]+)*)?|workshop(?:/content(?:/4000(?:/[0-9]+)*)?)?)$#D', $relative);
                }
                return !array_intersect(explode('/', $relative), self::ASSETS);
            }
        }
        return false;
    }

    public static function archiveOnly(string $path): bool
    {
        foreach (self::ARCHIVES as $root) { if ($path === $root || str_starts_with($path, $root . '/')) { return true; } }
        return false;
    }

    public static function file(string $path): bool
    {
        return ScannerSource::path($path) && self::directory(dirname($path));
    }
}
