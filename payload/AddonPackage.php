<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use RuntimeException;
use Symfony\Component\Process\Process;

final class AddonPackage
{
    public function __construct(private State $state) {}
    public static function key(string $name): string { return hash('sha256', 'gmod-toolkit:export:' . $name); }

    public static function cover(?string $encoded = null): string
    {
        if ($encoded !== null && strlen($encoded) > 1398104) { throw new RuntimeException('Cover image exceeds 1 MiB.'); }
        $bytes = $encoded === null ? file_get_contents(__DIR__ . '/cover.jpg') : base64_decode($encoded, true);
        $info = is_string($bytes) ? @getimagesizefromstring($bytes) : false;
        if (!$info || $info[0] !== 512 || $info[1] !== 512 || ($info['mime'] ?? '') !== 'image/jpeg' || strlen($bytes) > 1048576) {
            throw new RuntimeException('Choose a 512 × 512 JPEG cover smaller than 1 MiB.');
        }
        return $bytes;
    }

    public function start(array &$job, array $input): void
    {
        $name = trim((string) ($input['name'] ?? '')); $description = trim((string) ($input['description'] ?? ''));
        if (!mb_check_encoding($name . $description, 'UTF-8') || mb_strlen($name) < 1 || mb_strlen($name) > 80 || mb_strlen($description) > 5000
            || preg_match('/[\x00-\x1f\x7f]/u', $name) || preg_match('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u', $description)) {
            throw new RuntimeException('Use a name of 1–80 characters and a description of up to 5000 characters.');
        }
        $entries = []; $seen = [];
        foreach ($job['manifest'] as $path => $file) {
            $lower = strtolower($path);
            if (!AssetPolicy::path($path) || $file['bytes'] < 1 || (str_starts_with($lower, 'resource/') && !preg_match('#^resource/fonts/.+\.ttf$#D', $lower))
                || preg_match('/\.(?:sw|360|xbox)\.vtx$/D', $lower)) {
                throw new RuntimeException('Steam Workshop cannot package this asset: ' . $path . '. Remove it from this export and preview again.');
            }
            if (isset($seen[$lower])) { throw new RuntimeException('Workshop paths collide after lowercasing: ' . $path . '. Rename the duplicate and preview again.'); }
            $seen[$lower] = true;
            $entries[] = $file + ['path' => $lower];
        }
        if (!$entries) { throw new RuntimeException('Upload at least one asset before building a Workshop addon.'); }
        $cover = self::cover($input['cover'] ?? null);
        $path = $this->state->object($job['snapshot'], self::key('preview.jpg'));
        if (file_put_contents($path, $cover) !== strlen($cover)) { throw new RuntimeException('Cannot save the cover image.'); }
        chmod($path, 0600);
        $job['package'] = ['metadata' => ['title' => $name, 'description' => $description, 'type' => 'servercontent', 'tags' => []],
            'entries' => $entries, 'created' => time(), 'filename' => (trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($name)), '-') ?: 'server-content') . '-workshop.zip'];
        $job['phase'] = 'addon-index'; $job['cursor'] = 0;
    }

    private function invoke(array $job, array $input): array
    {
        $path = $this->state->object($job['snapshot'], self::key('input.json'));
        $bytes = json_encode($input, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        if (file_put_contents($path, $bytes) !== strlen($bytes)) { throw new RuntimeException('Cannot prepare the addon builder.'); }
        chmod($path, 0600);
        $process = new Process(['/usr/bin/python3', '-I', __DIR__ . '/package.py', $this->state->directory($job['snapshot']), $path]);
        $process->setTimeout(28); $process->run();
        if (!$process->isSuccessful() || strlen($process->getOutput()) > 4096) {
            throw new RuntimeException('Workshop packaging failed. An approved asset may have changed or a step exceeded its limit. Preview again.');
        }
        return json_decode($process->getOutput(), true, 16, JSON_THROW_ON_ERROR);
    }

    public function step(array &$job): void
    {
        $package = &$job['package'];
        if ($job['phase'] === 'addon-index') {
            $entry = &$package['entries'][$job['cursor']];
            $result = $this->invoke($job, ['mode' => 'index', 'entry' => $entry]);
            $entry['crc'] = $result['crc']; ++$job['cursor'];
            if ($job['cursor'] === count($package['entries'])) { $job['phase'] = 'addon-init'; $job['cursor'] = 0; }
        } elseif ($job['phase'] === 'addon-init') {
            $package += $this->invoke($job, ['mode' => 'init', 'entries' => $package['entries'], 'metadata' => $package['metadata'], 'created' => $package['created']]);
            $job['phase'] = 'addon-write';
        } elseif ($job['phase'] === 'addon-write') {
            $result = $this->invoke($job, ['mode' => 'append', 'entry' => $package['entries'][$job['cursor']], 'offset' => $package['offset'], 'streamCrc' => $package['streamCrc']]);
            $package['offset'] = $result['offset']; $package['streamCrc'] = $result['streamCrc']; ++$job['cursor'];
            if ($job['cursor'] === count($package['entries'])) { $job['phase'] = 'addon-finish'; }
        } elseif ($job['phase'] === 'addon-finish') {
            $package += $this->invoke($job, ['mode' => 'finish', 'metadata' => $package['metadata'], 'offset' => $package['offset'], 'streamCrc' => $package['streamCrc'], 'size' => $package['size']]);
            $job['status'] = 'addon-ready'; $job['expires'] = time() + 3600;
        } else { throw new RuntimeException('Invalid addon builder phase.'); }
    }
}
