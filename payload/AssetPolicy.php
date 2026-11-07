<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

final class AssetPolicy
{
    public const TYPES = [
        'maps' => ['bsp', 'nav', 'ain'], 'materials' => ['vmt', 'vtf'],
        'models' => ['mdl', 'vvd', 'vtx', 'phy', 'ani'], 'sound' => ['wav', 'mp3', 'ogg'],
        'particles' => ['pcf'], 'resource' => ['ttf', 'otf'],
    ];
    public const MAX_FILE = 134217728;
    public const MAX_TOTAL = 2147483648;
    public const MAX_FILES = 5000;

    public static function path(string $path): bool
    {
        $parts = explode('/', $path);
        if (strlen($path) > 240 || count($parts) < 2 || count($parts) > 16 || !isset(self::TYPES[$parts[0]])) { return false; }
        foreach ($parts as $part) {
            if (!preg_match('/^[A-Za-z0-9_+-][A-Za-z0-9_+.-]*$/D', $part) || str_ends_with($part, '.')
                || preg_match('/(?:^|[_.-])(?:secret|password|passwd|token|credential|config|backup|private)(?:[_.-]|$)/i', $part)) { return false; }
        }
        return in_array(strtolower(pathinfo($path, PATHINFO_EXTENSION)), self::TYPES[$parts[0]], true);
    }

    public static function ordinary(array $row, bool $directory = false): bool
    {
        return !($row['symlink'] ?? false) && !($row['is_symlink'] ?? false)
            && str_starts_with((string) ($row['mode'] ?? ''), $directory ? 'd' : '-');
    }
}
