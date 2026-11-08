<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

final class ScanScope
{
    public const VERSION = 'manual-v2';
    public const CODE = ['/garrysmod/lua', '/garrysmod/addons', '/garrysmod/gamemodes',
        '/garrysmod/data', '/garrysmod/cfg', '/garrysmod/materials'];
    public const ARCHIVES = ['/garrysmod/cache/srcds', '/garrysmod/cache/workshop',
        '/steamapps/workshop/content/4000', '/steam_cache'];
    private const ASSETS = ['maps', 'models', 'sound', 'particles', 'resource', 'screenshots', 'assets'];

    public static function roots(bool $archives): array { return $archives ? [...self::CODE, ...self::ARCHIVES] : self::CODE; }

    public static function selection(array $locations, bool $archives): array
    {
        if (!$locations || count($locations) > 50) { throw new \RuntimeException('Choose between 1 and 50 files or folders to scan.'); }
        $selected = [];
        foreach ($locations as $path) {
            if (!is_string($path) || (!self::directory($path, $archives) && !(self::file($path) && in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), $archives ? ['lua','txt','cfg','vmt','json','dat','js','gma','bin'] : ['lua','txt','cfg','vmt','json','dat','js'], true) && ($archives || !self::archiveOnly($path))))) { throw new \RuntimeException('Choose files or folders within the available GMod scan locations. Enable packed addons before selecting a Workshop cache.'); }
            $selected[$path] = true;
        }
        $paths = array_keys($selected); sort($paths);
        return array_values(array_filter($paths, static function ($path) use ($paths) {
            foreach ($paths as $parent) { if ($path !== $parent && str_starts_with($path, $parent . '/')) { return false; } }
            return true;
        }));
    }

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
