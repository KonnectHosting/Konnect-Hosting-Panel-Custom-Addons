<?php
declare(strict_types=1);

namespace AddonManager\Core;

use Closure;
use RuntimeException;

/** Public GitHub only. DNS is validated then pinned into cURL for every connection. */
final class GitHubDownloader
{
    private ?Closure $transport;
    private ?Closure $resolver;
    private array $limits;
    private float $deadline = 0;
    private const HOSTS = ['github.com','api.github.com','codeload.github.com','objects.githubusercontent.com','release-assets.githubusercontent.com'];

    public function __construct(?callable $transport = null, ?callable $resolver = null, array $limits = [])
    {
        $this->transport = $transport === null ? null : Closure::fromCallable($transport);
        $this->resolver = $resolver === null ? null : Closure::fromCallable($resolver);
        $this->limits = $limits + ['maxArchiveBytes'=>67108864,'maxMetadataBytes'=>1048576,'maxRedirects'=>5,'timeout'=>30,'maxTotalSeconds'=>120];
        foreach ($this->limits as $value) { if (!is_int($value) || $value < 1) { throw new RuntimeException('Download limits must be positive integers.'); } }
    }

    public function download(string $url, string $destination): array
    {
        $this->deadline = microtime(true) + $this->limits['maxTotalSeconds'];
        $parsed = $this->validateUrl($url);
        if (isset($parsed['query']) || $parsed['host'] !== 'github.com') { throw new RuntimeException('Use a public github.com package, folder, commit, or release ZIP URL.'); }
        $segments = explode('/', trim($parsed['path'] ?? '', '/'));
        if (count($segments) < 4 || !preg_match('/^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/D', $segments[0]) || !preg_match('/^[A-Za-z0-9_.-]{1,100}$/D', $segments[1]) || in_array($segments[1], ['.','..'], true)) { throw new RuntimeException('Unsupported GitHub package URL.'); }
        $owner = $segments[0]; $repository = preg_replace('/\.git$/', '', $segments[1]);
        $apiBase = 'https://api.github.com/repos/' . rawurlencode($owner) . '/' . rawurlencode($repository);
        $source = ['url'=>$this->redact($url),'owner'=>$owner,'repository'=>$repository]; $folder = null;
        if ($segments[2] === 'releases' && ($segments[3] ?? '') === 'download' && count($segments) === 6) {
            $tag = rawurldecode($segments[4]); $assetName = rawurldecode($segments[5]);
            $this->ref($tag); Paths::assertRelative($assetName);
            if (str_contains($assetName, '/') || !str_ends_with(strtolower($assetName), '.zip')) { throw new RuntimeException('GitHub release asset must be a ZIP file.'); }
            $release = $this->metadata($apiBase . '/releases/tags/' . rawurlencode($tag));
            if (!is_int($release['id'] ?? null) || $release['id'] < 1 || ($release['tag_name'] ?? null) !== $tag || !is_array($release['assets'] ?? null)) { throw new RuntimeException('GitHub returned invalid release metadata.'); }
            $asset = null;
            foreach ($release['assets'] as $candidate) { if (is_array($candidate) && ($candidate['name'] ?? null) === $assetName) { if ($asset !== null) { throw new RuntimeException('Ambiguous release asset.'); } $asset = $candidate; } }
            if ($asset === null || !is_int($asset['id'] ?? null) || $asset['id'] < 1 || !is_string($asset['browser_download_url'] ?? null)) { throw new RuntimeException('The requested public release ZIP asset was not found.'); }
            $downloadUrl = $asset['browser_download_url']; $assetUrl = $this->validateUrl($downloadUrl);
            if ($assetUrl['host'] !== 'github.com' || $this->redact($downloadUrl) !== $this->redact($url)) { throw new RuntimeException('Release asset URL does not match the requested repository asset.'); }
            $source += ['type'=>'release','ref'=>$tag,'releaseId'=>$release['id'],'assetId'=>$asset['id']];
            if (isset($asset['digest'])) {
                if (!is_string($asset['digest']) || !preg_match('/^sha256:([a-f0-9]{64})$/D', $asset['digest'], $m)) { throw new RuntimeException('GitHub returned an unsupported release asset digest.'); }
                $source['expectedSha256'] = $m[1];
            }
        } else {
            if ($segments[2] === 'tree') {
                $tail = array_slice($segments, 3);
                if (count($tail) > 12) { throw new RuntimeException('GitHub folder URL is too deep.'); }
                // GitHub branch names can contain slashes. Prefer the longest existing ref.
                $resolved = null;
                for ($length = count($tail); $length >= 1; $length--) {
                    $ref = implode('/', array_map('rawurldecode', array_slice($tail, 0, $length))); $this->ref($ref);
                    $response = $this->metadata($apiBase . '/commits/' . rawurlencode($ref), true);
                    if ($response !== null) { $resolved = $response; $remaining = array_slice($tail, $length); $folder = $remaining === [] ? null : implode('/', array_map('rawurldecode', $remaining)); break; }
                }
                if ($resolved === null) { throw new RuntimeException('GitHub folder ref could not be resolved.'); }
                if ($folder !== null) { Paths::assertRelative($folder); }
            } elseif ($segments[2] === 'commit' && count($segments) === 4 && preg_match('/^[a-fA-F0-9]{40}$/D', $segments[3])) {
                $ref = strtolower($segments[3]); $resolved = $this->metadata($apiBase . '/commits/' . $ref);
            } elseif ($segments[2] === 'archive' && str_ends_with(end($segments), '.zip')) {
                $refParts = array_slice($segments, 3);
                if (count($refParts) >= 3 && $refParts[0] === 'refs' && in_array($refParts[1], ['heads','tags'], true)) { $refParts = array_slice($refParts, 2); }
                $ref = rawurldecode(substr(implode('/', $refParts), 0, -4)); $this->ref($ref);
                $resolved = $this->metadata($apiBase . '/commits/' . rawurlencode($ref));
            } else { throw new RuntimeException('Unsupported GitHub link; use a release ZIP, tree folder, archive, or full commit URL.'); }
            if (!is_string($resolved['sha'] ?? null) || !preg_match('/^[a-f0-9]{40}$/D', $resolved['sha'])) { throw new RuntimeException('GitHub returned an invalid immutable commit identity.'); }
            if ($segments[2] === 'commit' && $resolved['sha'] !== $ref) { throw new RuntimeException('GitHub commit identity does not match the requested commit.'); }
            $source += ['type'=>'repository','ref'=>$ref,'commit'=>$resolved['sha']];
            $downloadUrl = 'https://codeload.github.com/' . rawurlencode($owner) . '/' . rawurlencode($repository) . '/zip/' . $resolved['sha'];
        }
        if (!file_exists($destination)) {
            Paths::realDirectory(dirname($destination));
            Paths::assertRelative(basename($destination));
            if (!mkdir($destination, 0700)) { throw new RuntimeException('Cannot create private download directory.'); }
        }
        $root = Paths::realDirectory($destination);
        $archive = $root . '/archive-' . bin2hex(random_bytes(12)) . '.zip';
        $response = $this->request($downloadUrl, $this->limits['maxArchiveBytes']);
        try {
            if ($response['status'] !== 200) { throw new RuntimeException('GitHub archive download failed (HTTP ' . $response['status'] . ').'); }
            $input = $this->bodyStream($response); $output = fopen($archive, 'xb');
            if ($output === false) { fclose($input); throw new RuntimeException('Cannot create downloaded archive.'); }
            try { $bytes = stream_copy_to_stream($input, $output, $this->limits['maxArchiveBytes'] + 1); }
            finally { fclose($input); fclose($output); }
            if ($bytes === false || $bytes === 0 || $bytes > $this->limits['maxArchiveBytes']) { throw new RuntimeException('Archive download size is outside allowed limits.'); }
            chmod($archive, 0600); $digest = hash_file('sha256', $archive);
            if ($digest === false || (isset($source['expectedSha256']) && !hash_equals($source['expectedSha256'], $digest))) { throw new RuntimeException('GitHub release asset digest does not match downloaded bytes.'); }
            $source['resolvedUrl'] = $this->redact($response['url']);
            return ['archive'=>$archive,'sha256'=>$digest,'source'=>$source,'folder'=>$folder];
        } catch (\Throwable $e) { if (is_file($archive)) { unlink($archive); } throw $e; }
        finally { $this->cleanupResponse($response); }
    }

    private function metadata(string $url, bool $allowNotFound = false): ?array
    {
        $response = $this->request($url, $this->limits['maxMetadataBytes']);
        try {
            if ($allowNotFound && $response['status'] === 404) { return null; }
            if ($response['status'] !== 200) { throw new RuntimeException('GitHub metadata request failed (HTTP ' . $response['status'] . ').'); }
            $stream = $this->bodyStream($response);
            try { $body = stream_get_contents($stream, $this->limits['maxMetadataBytes'] + 1); } finally { fclose($stream); }
            if ($body === false || strlen($body) > $this->limits['maxMetadataBytes']) { throw new RuntimeException('GitHub metadata is oversized.'); }
            try { $decoded = json_decode($body, true, 64, JSON_THROW_ON_ERROR); } catch (\JsonException $e) { throw new RuntimeException('GitHub returned invalid JSON.', 0, $e); }
            if (!is_array($decoded) || array_is_list($decoded)) { throw new RuntimeException('GitHub returned invalid metadata.'); }
            return $decoded;
        } finally { $this->cleanupResponse($response); }
    }

    private function request(string $url, int $maxBytes): array
    {
        for ($redirect = 0; ; $redirect++) {
            $parts = $this->validateUrl($url); $host = $parts['host'];
            $addresses = $this->resolve($host);
            $remaining = (int) ceil($this->deadline - microtime(true));
            if ($remaining < 1) { throw new RuntimeException('GitHub download exceeded the total time limit.'); }
            $request = ['url'=>$url,'host'=>$host,'addresses'=>$addresses,'headers'=>['Accept'=>'application/vnd.github+json','User-Agent'=>'Addon-Manager/' . (defined('ADDON_MANAGER_VERSION') ? ADDON_MANAGER_VERSION : '2.0.0'),'X-GitHub-Api-Version'=>'2022-11-28'],'maxBytes'=>$maxBytes,'timeout'=>min($remaining, $this->limits['timeout'])];
            $response = $this->transport !== null ? ($this->transport)($request) : $this->curl($request);
            if (!is_array($response) || !is_int($response['status'] ?? null) || !is_array($response['headers'] ?? [])) { throw new RuntimeException('Invalid HTTP transport response.'); }
            $response['url'] = $url; $headers = [];
            foreach ($response['headers'] ?? [] as $name => $value) {
                if (!is_string($name) || (!is_string($value) && !is_array($value))) { $this->cleanupResponse($response); throw new RuntimeException('Invalid HTTP headers.'); }
                if (is_array($value)) { if (count($value) !== 1 || !is_string($value[0] ?? null)) { $this->cleanupResponse($response); throw new RuntimeException('Ambiguous HTTP header.'); } $value = $value[0]; }
                $normalizedName = strtolower($name);
                if ($normalizedName === 'location' && isset($headers[$normalizedName])) { $this->cleanupResponse($response); throw new RuntimeException('Ambiguous redirect Location header.'); }
                $headers[$normalizedName] = $value;
            }
            if (isset($response['body']) && (!is_string($response['body']) || strlen($response['body']) > $maxBytes)) { $this->cleanupResponse($response); throw new RuntimeException('HTTP response exceeded the size limit.'); }
            if (isset($response['file']) && (!is_string($response['file']) || !is_file($response['file']) || is_link($response['file']) || filesize($response['file']) > $maxBytes)) { $this->cleanupResponse($response); throw new RuntimeException('HTTP response file exceeded the size limit.'); }
            if (!in_array($response['status'], [301,302,303,307,308], true)) { return $response; }
            $this->cleanupResponse($response);
            if ($redirect >= $this->limits['maxRedirects'] || !isset($headers['location'])) { throw new RuntimeException('GitHub redirect limit exceeded or missing Location.'); }
            $url = $this->redirectUrl($url, $headers['location']);
        }
    }

    private function validateUrl(string $url): array
    {
        if (strlen($url) > 8192 || preg_match('/[\x00-\x20\x7f\\\\]/', $url)) { throw new RuntimeException('Invalid package URL.'); }
        $parts = parse_url($url);
        if ($parts === false || ($parts['scheme'] ?? '') !== 'https' || !isset($parts['host']) || !in_array(strtolower($parts['host']), self::HOSTS, true) || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment']) || (isset($parts['port']) && $parts['port'] !== 443)) { throw new RuntimeException('Only credential-free HTTPS URLs on supported GitHub hosts are allowed.'); }
        $parts['host'] = strtolower($parts['host']);
        return $parts;
    }

    private function resolve(string $host): array
    {
        if ($this->resolver !== null) { $addresses = ($this->resolver)($host); }
        else {
            $records = @dns_get_record($host, DNS_A | DNS_AAAA); $addresses = [];
            foreach ($records ?: [] as $record) { if (isset($record['ip'])) { $addresses[] = $record['ip']; } elseif (isset($record['ipv6'])) { $addresses[] = $record['ipv6']; } }
        }
        if (!is_array($addresses) || $addresses === [] || count($addresses) > 64) { throw new RuntimeException('GitHub hostname did not resolve to usable addresses.'); }
        foreach ($addresses as $address) { if (!is_string($address) || !self::publicAddress($address)) { throw new RuntimeException('GitHub hostname resolves to a forbidden address.'); } }
        return array_values(array_unique($addresses));
    }

    public static function publicAddress(string $address): bool
    {
        $packed = @inet_pton($address);
        if ($packed === false) { return false; }
        if (strlen($packed) === 4) {
            foreach (['0.0.0.0/8','10.0.0.0/8','100.64.0.0/10','127.0.0.0/8','169.254.0.0/16','172.16.0.0/12','192.0.0.0/24','192.0.2.0/24','192.168.0.0/16','198.18.0.0/15','198.51.100.0/24','203.0.113.0/24','224.0.0.0/4','240.0.0.0/4'] as $range) { if (self::cidr($packed, $range)) { return false; } }
            return true;
        }
        if (!self::cidr($packed, '2000::/3')) { return false; }
        foreach (['2001::/32','2001:2::/48','2001:db8::/32','2001:10::/28','2001:20::/28','2002::/16'] as $range) { if (self::cidr($packed, $range)) { return false; } }
        return true;
    }

    private static function cidr(string $address, string $range): bool
    {
        [$network, $bits] = explode('/', $range); $network = inet_pton($network); $bits = (int) $bits;
        if ($network === false || strlen($address) !== strlen($network)) { return false; }
        $bytes = intdiv($bits, 8); $remainder = $bits % 8;
        return substr($address, 0, $bytes) === substr($network, 0, $bytes) && ($remainder === 0 || ((ord($address[$bytes]) ^ ord($network[$bytes])) & (0xff << (8 - $remainder))) === 0);
    }

    private function curl(array $request): array
    {
        if (!function_exists('curl_init')) { throw new RuntimeException('The PHP curl extension is required for secure pinned HTTPS downloads.'); }
        $temporary = tempnam(sys_get_temp_dir(), 'addon-manager-http-');
        if ($temporary === false || ($output = fopen($temporary, 'wb')) === false) { throw new RuntimeException('Cannot create private HTTP response file.'); }
        chmod($temporary, 0600); $curl = curl_init(); $bytes = 0; $headers = []; $headerError = false; $headerBytes = 0;
        $address = $request['addresses'][0]; if (str_contains($address, ':')) { $address = '[' . $address . ']'; }
        $headerLines = []; foreach ($request['headers'] as $name => $value) { $headerLines[] = $name . ': ' . $value; }
        curl_setopt_array($curl, [CURLOPT_URL=>$request['url'],CURLOPT_FOLLOWLOCATION=>false,CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_REDIR_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROXY=>'',CURLOPT_RESOLVE=>[$request['host'] . ':443:' . $address],CURLOPT_CONNECTTIMEOUT=>min(10, $request['timeout']),CURLOPT_TIMEOUT=>$request['timeout'],CURLOPT_HTTPHEADER=>$headerLines,CURLOPT_MAXFILESIZE=>$request['maxBytes'],CURLOPT_HEADERFUNCTION=>static function ($handle, string $line) use (&$headers, &$headerError, &$headerBytes): int {
            $headerBytes += strlen($line); if ($headerBytes > 65536) { $headerError = true; return 0; }
            if (preg_match('#^HTTP/#', $line)) { $headers = []; }
            elseif (str_contains($line, ':')) {
                [$name,$value] = explode(':', $line, 2); $name = strtolower(trim($name));
                if ($name === 'location' && isset($headers[$name])) { $headerError = true; }
                $headers[$name] = trim($value);
            }
            return strlen($line);
        },CURLOPT_WRITEFUNCTION=>static function ($handle, string $chunk) use ($output, &$bytes, $request): int {
            $bytes += strlen($chunk); if ($bytes > $request['maxBytes']) { return 0; }
            $written = fwrite($output, $chunk); return $written === false ? 0 : $written;
        }]);
        try {
            $ok = curl_exec($curl); $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE); $peer = (string) curl_getinfo($curl, CURLINFO_PRIMARY_IP);
            $approvedPeer = false;
            foreach ($request['addresses'] as $approved) { if (@inet_pton($peer) !== false && @inet_pton($peer) === @inet_pton($approved)) { $approvedPeer = true; break; } }
            if ($ok === false || $headerError || !$approvedPeer || !self::publicAddress($peer)) { throw new RuntimeException('Verified HTTPS download failed: ' . ($bytes > $request['maxBytes'] ? 'response exceeded size limit' : curl_error($curl))); }
            return ['status'=>$status,'headers'=>$headers,'file'=>$temporary,'_temporary'=>true];
        } catch (\Throwable $e) { unlink($temporary); throw $e; }
        finally { fclose($output); curl_close($curl); }
    }

    private function bodyStream(array $response)
    {
        if (isset($response['file'])) { $stream = fopen($response['file'], 'rb'); }
        else { $stream = fopen('php://temp', 'w+b'); if ($stream !== false) { fwrite($stream, $response['body'] ?? ''); rewind($stream); } }
        if ($stream === false) { throw new RuntimeException('Cannot read HTTP response.'); } return $stream;
    }

    private function cleanupResponse(array $response): void { if (($response['_temporary'] ?? false) && isset($response['file']) && is_file($response['file'])) { unlink($response['file']); } }
    private function ref(string $ref): void { if ($ref === '' || strlen($ref) > 250 || preg_match('/[\x00-\x20\x7f~^:?*\[\\\\]/', $ref) || str_contains($ref, '..') || str_contains($ref, '@{') || str_starts_with($ref, '/') || str_ends_with($ref, '/')) { throw new RuntimeException('Invalid GitHub ref.'); } }
    private function redact(string $url): string { $parts = parse_url($url); return 'https://' . strtolower($parts['host']) . ($parts['path'] ?? '/'); }
    private function redirectUrl(string $base, string $location): string
    {
        if (str_starts_with($location, 'https://')) { return $location; }
        if (str_starts_with($location, '//')) { return 'https:' . $location; }
        if (preg_match('/^[A-Za-z][A-Za-z0-9+.-]*:/', $location)) { throw new RuntimeException('Redirect changes the permitted protocol.'); }
        $parts = parse_url($base); $origin = 'https://' . $parts['host'];
        if (str_starts_with($location, '/')) { return $origin . $location; }
        if (str_starts_with($location, '?')) { return $origin . ($parts['path'] ?? '/') . $location; }
        return $origin . substr($parts['path'] ?? '/', 0, strrpos($parts['path'] ?? '/', '/') + 1) . $location;
    }
}
