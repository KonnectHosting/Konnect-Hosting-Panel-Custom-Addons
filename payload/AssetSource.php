<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use RuntimeException;

class AssetSource
{
    public function __construct(private DaemonFileRepository $files) {}

    private function rows(Server $server, string $path): array
    {
        $response = $this->files->setServer($server)->getHttpClient()->get('/api/servers/' . $server->uuid . '/files/list-directory', [
            'query' => ['directory' => $path], 'stream' => true, 'timeout' => 5, 'read_timeout' => 5,
        ]);
        $bytes = ''; $body = $response->getBody();
        while (!$body->eof()) {
            $bytes .= $body->read(65536);
            if (strlen($bytes) > 4194304) { throw new RuntimeException('Asset directory listing exceeds the limit.'); }
        }
        $rows = json_decode($bytes, true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($rows) || !array_is_list($rows) || count($rows) > 10000) { throw new RuntimeException('Invalid or oversized asset directory.'); }
        return $rows;
    }

    private function parent(Server $server, string $relative): void
    {
        $current = '/';
        foreach (explode('/', 'garrysmod' . ($relative === '' ? '' : '/' . $relative)) as $part) {
            $found = null;
            foreach ($this->rows($server, $current) as $row) {
                if (($row['name'] ?? '') === $part) { $found = $row; break; }
            }
            if (!$found || !AssetPolicy::ordinary($found, true)) { throw new RuntimeException('Asset directory is missing or is a symbolic link.'); }
            $current = rtrim($current, '/') . '/' . $part;
        }
    }

    public function listing(Server $server, string $relative): array
    {
        $this->parent($server, $relative);
        return $this->rows($server, '/garrysmod' . ($relative === '' ? '' : '/' . $relative));
    }

    public function copy(Server $server, string $relative, array $expected, string $target): array
    {
        if (!AssetPolicy::path($relative)) { throw new RuntimeException('Forbidden asset path.'); }
        $rows = $this->listing($server, dirname($relative)); $found = null;
        foreach ($rows as $row) { if (($row['name'] ?? '') === basename($relative)) { $found = $row; break; } }
        if (!$found || !AssetPolicy::ordinary($found) || ($found['size'] ?? -1) !== $expected['bytes']
            || ($found['modified'] ?? null) !== $expected['modified']) { throw new RuntimeException('An asset changed during preview. Preview again.'); }
        $response = $this->files->setServer($server)->getHttpClient()->get('/api/servers/' . $server->uuid . '/files/contents', [
            'query' => ['file' => '/garrysmod/' . $relative], 'stream' => true, 'timeout' => 15, 'read_timeout' => 15,
        ]);
        $fd = fopen($target, 'xb');
        if (!$fd) { throw new RuntimeException('Cannot write private asset snapshot.'); }
        chmod($target, 0600);
        $hash = hash_init('sha256'); $bytes = 0; $deadline = microtime(true) + 15;
        try {
            $body = $response->getBody();
            while (!$body->eof()) {
                $chunk = $body->read(65536); $bytes += strlen($chunk);
                if ($bytes > $expected['bytes'] || $bytes > AssetPolicy::MAX_FILE || microtime(true) > $deadline) {
                    throw new RuntimeException('Asset transfer exceeded its preview size/time limit.');
                }
                hash_update($hash, $chunk);
                if (fwrite($fd, $chunk) !== strlen($chunk)) { throw new RuntimeException('Asset snapshot write failed.'); }
            }
            if ($bytes !== $expected['bytes']) { throw new RuntimeException('Asset changed during transfer.'); }
        } finally { fclose($fd); }
        $rows = $this->listing($server, dirname($relative)); $after = null;
        foreach ($rows as $row) { if (($row['name'] ?? '') === basename($relative)) { $after = $row; break; } }
        if (!$after || !AssetPolicy::ordinary($after) || $after['size'] !== $found['size'] || ($after['modified'] ?? null) !== ($found['modified'] ?? null)) {
            throw new RuntimeException('An asset changed during transfer. Preview again.');
        }
        return ['bytes' => $bytes, 'sha256' => hash_final($hash), 'object' => hash('sha256', $relative)];
    }
}
