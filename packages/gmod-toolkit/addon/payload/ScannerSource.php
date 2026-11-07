<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use Pterodactyl\Models\Server;
use Pterodactyl\Repositories\Wings\DaemonFileRepository;
use RuntimeException;

class ScannerSource
{
    public function __construct(private DaemonFileRepository $files) {}

    public static function path(string $path): bool
    {
        if ($path === '/') { return true; }
        if (!str_starts_with($path, '/') || strlen($path) > 512 || count(explode('/', $path)) > 26
            || preg_match('/[\\\\\x00-\x1f\x7f]/', $path) || !mb_check_encoding($path, 'UTF-8')) { return false; }
        foreach (explode('/', substr($path, 1)) as $part) { if (in_array($part, ['', '.', '..'], true)) { return false; } }
        return true;
    }

    private function rows(Server $server, string $path, float $deadline): array
    {
        $remaining = min(5.0, $deadline - microtime(true));
        if ($remaining < 0.1) { throw new RuntimeException('File inspection exceeded its time limit.'); }
        $response = $this->files->setServer($server)->getHttpClient()->get('/api/servers/' . $server->uuid . '/files/list-directory', [
            'query' => ['directory' => $path], 'stream' => true, 'timeout' => $remaining, 'read_timeout' => $remaining]);
        $body = $response->getBody(); $bytes = '';
        try {
            while (!$body->eof()) {
                $bytes .= $body->read(65536);
                if (strlen($bytes) > 8388608 || microtime(true) > $deadline) { throw new RuntimeException('Directory listing exceeded its size/time limit.'); }
            }
        } finally { $body->close(); }
        $rows = json_decode($bytes, true, 16, JSON_THROW_ON_ERROR);
        if (!is_array($rows) || !array_is_list($rows) || count($rows) > 20000) { throw new RuntimeException('Directory listing is invalid or exceeds 20,000 entries.'); }
        return $rows;
    }

    private function ancestors(Server $server, string $path, float $deadline): void
    {
        if (!self::path($path)) { throw new RuntimeException('Invalid scan path.'); }
        if ($path === '/') { return; }
        $current = '/';
        foreach (explode('/', ltrim($path, '/')) as $part) {
            $found = null;
            foreach ($this->rows($server, $current, $deadline) as $row) { if (($row['name'] ?? '') === $part) { $found = $row; break; } }
            if (!$found || !AssetPolicy::ordinary($found, true)) { throw new RuntimeException('Directory disappeared, changed type or is a symbolic link.'); }
            $current = rtrim($current, '/') . '/' . $part;
        }
    }

    public function listing(Server $server, string $path): array
    {
        $deadline = microtime(true) + 18;
        $this->ancestors($server, $path, $deadline);
        return $this->rows($server, $path, $deadline);
    }

    public function copy(Server $server, string $path, array $expected, string $target): void
    {
        if (!self::path($path) || !is_int($expected['bytes']) || $expected['bytes'] < 0 || $expected['bytes'] > 1073741824) { throw new RuntimeException('Invalid scan file.'); }
        $deadline = microtime(true) + 22;
        $parent = dirname($path);
        $this->ancestors($server, $parent, $deadline);
        $check = function () use ($server, $parent, $path, $deadline, $expected) {
            foreach ($this->rows($server, $parent, $deadline) as $row) {
                if (($row['name'] ?? '') === basename($path) && AssetPolicy::ordinary($row)
                    && ($row['size'] ?? -1) === $expected['bytes'] && ($row['modified'] ?? null) === $expected['modified']) { return; }
            }
            throw new RuntimeException('File changed, disappeared or is a symbolic link. Run another scan after editing.');
        };
        $check();
        $remaining = min(18.0, $deadline - microtime(true));
        if ($remaining < 0.1) { throw new RuntimeException('File inspection exceeded its time limit.'); }
        $response = $this->files->setServer($server)->getHttpClient()->get('/api/servers/' . $server->uuid . '/files/contents', [
            'query' => ['file' => $path], 'stream' => true, 'timeout' => $remaining, 'read_timeout' => $remaining]);
        $fd = fopen($target, 'xb');
        if (!$fd) { throw new RuntimeException('Cannot create private scan input.'); }
        chmod($target, 0600); $body = $response->getBody(); $bytes = 0;
        try {
            while (!$body->eof()) {
                $chunk = $body->read(65536); $bytes += strlen($chunk);
                if ($bytes > $expected['bytes'] || microtime(true) > $deadline) { throw new RuntimeException('File transfer exceeded its declared size/time limit.'); }
                if (fwrite($fd, $chunk) !== strlen($chunk)) { throw new RuntimeException('Private scan input could not be written.'); }
            }
            if ($bytes !== $expected['bytes']) { throw new RuntimeException('File changed during transfer.'); }
        } finally { fclose($fd); $body->close(); }
        $this->ancestors($server, $parent, $deadline);
        $check();
    }
}
