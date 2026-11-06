<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use Closure;
use GuzzleHttp\Client;
use RuntimeException;

final class Workshop
{
    private Closure $fetch;

    public function __construct(?Closure $fetch = null)
    {
        $this->fetch = $fetch ?? static function (string $method, array $ids): array {
            $collection = $method === 'GetCollectionDetails';
            $params = [($collection ? 'collectioncount' : 'itemcount') => count($ids)];
            foreach ($ids as $i => $id) { $params['publishedfileids[' . $i . ']'] = $id; }
            // No user-controlled host, credentials, redirects or download URLs.
            $response = (new Client())->post('https://api.steampowered.com/ISteamRemoteStorage/' . $method . '/v1/', [
                'form_params' => $params, 'connect_timeout' => 5, 'timeout' => 12,
                'allow_redirects' => false, 'verify' => true, 'stream' => true,
            ]);
            $body = $response->getBody(); $bytes = '';
            while (!$body->eof()) {
                $bytes .= $body->read(65536);
                if (strlen($bytes) > 4 * 1024 * 1024) { throw new RuntimeException('Steam response exceeded the limit.'); }
            }
            return json_decode($bytes, true, 64, JSON_THROW_ON_ERROR)['response'] ?? [];
        };
    }

    public static function id(string $input): string
    {
        $value = trim($input);
        if (preg_match('#^https?://#i', $value)) {
            $url = parse_url($value);
            if (!$url || strtolower($url['host'] ?? '') !== 'steamcommunity.com' || isset($url['user']) || isset($url['pass']) || isset($url['port'])
                || !in_array(rtrim($url['path'] ?? '', '/'), ['/sharedfiles/filedetails', '/workshop/filedetails'], true)) {
                throw new RuntimeException('Use a Steam collection ID or steamcommunity.com collection link.');
            }
            $ids = [];
            foreach (explode('&', $url['query'] ?? '') as $part) {
                [$key, $entry] = array_pad(explode('=', $part, 2), 2, '');
                if (rawurldecode($key) === 'id') { $ids[] = rawurldecode($entry); }
            }
            if (count($ids) !== 1) { throw new RuntimeException('Collection link needs exactly one ID.'); }
            $value = $ids[0];
        }
        if (!preg_match('/^[1-9][0-9]{0,19}$/D', $value) || (strlen($value) === 20 && strcmp($value, '18446744073709551615') > 0)) {
            throw new RuntimeException('Invalid Steam Workshop ID.');
        }
        return $value;
    }

    public function resolve(string $input): array
    {
        $root = self::id($input); $items = []; $collections = []; $details = []; $duplicates = 0;
        $deadline = microtime(true) + 25;
        $load = function (array $ids) use (&$details, $deadline): void {
            $missing = array_values(array_filter($ids, static fn ($id) => !isset($details[$id])));
            foreach (array_chunk(array_unique($missing), 100) as $batch) {
                if (microtime(true) > $deadline) { throw new RuntimeException('Steam resolution timed out; retry.'); }
                $response = ($this->fetch)('GetPublishedFileDetails', $batch);
                foreach ($response['publishedfiledetails'] ?? [] as $item) {
                    $id = self::id((string) ($item['publishedfileid'] ?? ''));
                    $details[$id] = $item;
                }
                foreach ($batch as $id) {
                    $item = $details[$id] ?? [];
                    if (($item['result'] ?? null) !== 1 || (int) ($item['consumer_app_id'] ?? 0) !== 4000) {
                        throw new RuntimeException('Workshop item ' . $id . ' is unavailable, private, or is not for Garry\'s Mod.');
                    }
                }
            }
        };
        $walk = function (string $id, int $depth, int $type) use (&$walk, &$items, &$collections, &$duplicates, &$details, $load, $deadline): void {
            if ($depth > 12 || microtime(true) > $deadline) { throw new RuntimeException('Collection depth/time limit exceeded.'); }
            $load([$id]);
            if ($type === 2) {
                if (isset($collections[$id])) { ++$duplicates; return; }
                if (count($collections) >= 64) { throw new RuntimeException('A maximum of 64 nested collections is supported.'); }
                $collections[$id] = true;
                $response = ($this->fetch)('GetCollectionDetails', [$id]);
                $collection = $response['collectiondetails'][0] ?? [];
                if (($collection['result'] ?? null) !== 1 || (string) ($collection['publishedfileid'] ?? '') !== $id) {
                    throw new RuntimeException('Steam could not read collection ' . $id . '. Check that it is a public collection.');
                }
                $children = $collection['children'] ?? [];
                if (!is_array($children) || count($children) > 1000) { throw new RuntimeException('Collection is too large.'); }
                $ids = array_map(static fn ($child) => self::id((string) ($child['publishedfileid'] ?? '')), $children);
                if (count($details) + count(array_diff($ids, array_map('strval', array_keys($details)))) > 1500) {
                    throw new RuntimeException('Collection graph exceeds the lookup limit.');
                }
                $load($ids);
                foreach ($children as $index => $child) {
                    // GetPublishedFileDetails does not reliably include file_type.
                    // GetCollectionDetails identifies collections and supplies each
                    // child's documented filetype (0 = item, 2 = collection).
                    $childType = filter_var($child['filetype'] ?? null, FILTER_VALIDATE_INT);
                    if (!in_array($childType, [0, 2], true)) { throw new RuntimeException('Steam returned an unsupported collection entry type.'); }
                    $walk($ids[$index], $depth + 1, $childType);
                }
            } elseif ($type === 0) {
                if (isset($items[$id])) { ++$duplicates; return; }
                if (count($items) >= 500) { throw new RuntimeException('A maximum of 500 Workshop addons is supported.'); }
                $items[$id] = ['id' => $id, 'title' => mb_substr((string) ($details[$id]['title'] ?? $id), 0, 200)];
            } else { throw new RuntimeException('Unsupported Workshop item type.'); }
        };
        $load([$root]);
        // The collection endpoint, rather than an optional metadata field,
        // determines whether the supplied root really is a collection.
        $walk($root, 0, 2);
        $lua = "-- Generated by GMod Toolkit: client Workshop downloads only.\n-- Server mounting is configured separately with host_workshop_collection.\n";
        foreach ($items as $item) { $lua .= 'resource.AddWorkshop("' . $item['id'] . '")' . "\n"; }
        return ['collection' => $root, 'items' => array_values($items), 'collections' => count($collections), 'duplicates' => $duplicates, 'lua' => $lua];
    }
}
