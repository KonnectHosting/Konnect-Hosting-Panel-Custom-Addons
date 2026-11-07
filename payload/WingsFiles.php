<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use RuntimeException;

class WingsFiles
{
    public const LUA = '/garrysmod/lua/autorun/server/gmod_toolkit_workshop.lua';

    public function __construct(private DaemonFileRepository $files) {}

    private function directory(Server $server, string $path, bool $create = false): bool
    {
        $current = '/';
        foreach (explode('/', trim($path, '/')) as $part) {
            $rows = $this->files->setServer($server)->getDirectory($current);
            $match = null;
            foreach ($rows as $row) { if (($row['name'] ?? '') === $part) { $match = $row; break; } }
            if (!$match) {
                if (!$create) { return false; }
                // Never create the game root: a wrong egg/layout must fail clearly.
                if ($part === 'garrysmod') { throw new RuntimeException('The server has no garrysmod directory.'); }
                $this->files->createDirectory($part, $current);
                $match = null;
                foreach ($this->files->getDirectory($current) as $row) { if (($row['name'] ?? '') === $part) { $match = $row; break; } }
            }
            if (!$match || ($match['symlink'] ?? $match['is_symlink'] ?? false) || !str_starts_with((string) ($match['mode'] ?? ''), 'd')) {
                throw new RuntimeException('Toolkit paths must contain ordinary directories, without symbolic links.');
            }
            $current = rtrim($current, '/') . '/' . $part;
        }
        return true;
    }

    public function read(Server $server): ?string
    {
        $dir = dirname(self::LUA);
        if (!$this->directory($server, $dir)) { return null; }
        $match = null;
        foreach ($this->files->setServer($server)->getDirectory($dir) as $row) {
            if (($row['name'] ?? '') === basename(self::LUA)) { $match = $row; break; }
        }
        if (!$match) { return null; }
        if (($match['symlink'] ?? $match['is_symlink'] ?? false) || !str_starts_with((string) ($match['mode'] ?? ''), '-') || ($match['size'] ?? PHP_INT_MAX) > 1048576) {
            throw new RuntimeException('Existing Workshop Lua must be a regular file smaller than 1 MiB.');
        }
        // Enforce the actual streamed length, rather than trusting Content-Length.
        $response = $this->files->getHttpClient()->get('/api/servers/' . $server->uuid . '/files/contents', [
            'query' => ['file' => self::LUA], 'stream' => true, 'timeout' => 15,
        ]);
        $bytes = ''; $body = $response->getBody();
        while (!$body->eof()) {
            $bytes .= $body->read(65536);
            if (strlen($bytes) > 1048576) { throw new RuntimeException('Workshop Lua exceeds 1 MiB.'); }
        }
        if (!mb_check_encoding($bytes, 'UTF-8')) { throw new RuntimeException('Existing Workshop Lua must be UTF-8 text for preview.'); }
        return $bytes;
    }

    public function write(Server $server, string $bytes): void
    {
        $dir = dirname(self::LUA);
        $this->directory($server, $dir, true);
        // Wings' rename endpoint refuses an existing destination. Use its normal
        // file write API; the controller durably saves the previous bytes first.
        $this->files->setServer($server)->putContent(self::LUA, $bytes);
        if ($this->read($server) !== $bytes) {
            throw new RuntimeException('Workshop Lua verification failed. The previous version is available in private backups.');
        }
    }
}
