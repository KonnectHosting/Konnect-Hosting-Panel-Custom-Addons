<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use GuzzleHttp\Client;
use Pterodactyl\Models\Server;
use RuntimeException;

class NodeClient
{
    public function __construct(private State $state) {}

    public static function origin(string $fqdn): string
    {
        if (strlen($fqdn) > 253 || !preg_match('/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/iD', $fqdn) || str_contains($fqdn, '..')) {
            throw new RuntimeException('FastDL requires a valid node FQDN.');
        }
        return 'https://' . strtolower($fqdn);
    }

    public function call(Server $server, int $actor, string $action, array $extra = []): array
    {
        if (!in_array($action, ['info', 'preview', 'publish', 'rotate', 'revoke'], true)) { throw new RuntimeException('Invalid node operation.'); }
        $key = $this->state->read('settings')['nodes'][(string) $server->node_id] ?? null;
        if (!is_string($key) || !preg_match('/^[a-f0-9]{64}$/D', $key)) { throw new RuntimeException('An administrator must provision the FastDL publisher on this node.'); }
        $body = json_encode(['server' => $server->uuid, 'actor' => (string) $actor] + $extra, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $path = '/gmod-toolkit-api/v1/' . $action;
        $timestamp = (string) time(); $nonce = bin2hex(random_bytes(32));
        $signature = hash_hmac('sha256', implode("\n", ['POST', $path, $timestamp, $nonce, hash('sha256', $body)]), hex2bin($key));
        $response = (new Client())->post(self::origin($server->node->fqdn) . $path, [
            'body' => $body, 'headers' => ['Content-Type' => 'application/json', 'X-Gmod-Time' => $timestamp, 'X-Gmod-Nonce' => $nonce, 'X-Gmod-Signature' => $signature],
            'verify' => true, 'allow_redirects' => false, 'connect_timeout' => 3, 'timeout' => $action === 'info' ? 5 : 35, 'stream' => true, 'http_errors' => false,
        ]);
        $body = $response->getBody(); $bytes = '';
        while (!$body->eof()) {
            $bytes .= $body->read(65536);
            if (strlen($bytes) > 2097152) { throw new RuntimeException('Node response exceeded the limit.'); }
        }
        $result = json_decode($bytes, true, 64, JSON_THROW_ON_ERROR);
        if ($response->getStatusCode() !== 200 || !is_array($result)) {
            throw new RuntimeException('Node rejected the FastDL operation: ' . substr((string) ($result['message'] ?? 'check node configuration'), 0, 300));
        }
        if (isset($result['token'])) {
            if (!preg_match('/^[a-f0-9]{64}$/D', $result['token'])) { throw new RuntimeException('Invalid node download token.'); }
            $result['url'] = self::origin($server->node->fqdn) . '/fastdl/' . $result['token'] . '/';
        }
        unset($result['token']);
        return $result;
    }
}
