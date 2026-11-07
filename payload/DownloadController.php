<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

final class DownloadController
{
    public function __invoke(string $token, string $path, Fastdl $fastdl): mixed
    {
        $asset = $fastdl->download($token, $path);
        return response()->file($asset['path'], ['Content-Type' => 'application/octet-stream', 'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'public, max-age=0, must-revalidate']);
    }
}
