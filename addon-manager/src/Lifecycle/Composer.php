<?php

declare(strict_types=1);

namespace AddonManager\Lifecycle;

use AddonManager\Core\PackageValidator;
use AddonManager\Core\Paths;
use AddonManager\Storage\Files;
use RuntimeException;

/** Reconstructs from immutable originals; it never reverses patches on live code. */
final class Composer
{
    public function compose(string $baselineRoot, array $baselineInventory, string $stageRoot, array $addons, array $order, array $owners = [], string $defaultOwner = 'baseline'): array
    {
        if (Files::inventory($baselineRoot) !== $baselineInventory) {
            throw new RuntimeException('Protected baseline contains missing, changed, or unexpected source files.');
        }
        Files::copyInventory($baselineRoot, $stageRoot, $baselineInventory);
        $inventory = $baselineInventory;
        $fileOwners = [];
        $segments = [];
        $ledger = [];
        foreach ($baselineInventory as $path => $hash) {
            $fileOwners[$path] = $this->baselineOwner($path, $owners, $defaultOwner);
        }
        foreach ($order as $id) {
            $addon = $addons[$id];
            $packageRoot = $addon['packagePath'];
            $manifest = (new PackageValidator())->validate($packageRoot);
            if ($manifest !== $addon['manifest']) {
                throw new RuntimeException("Frozen manifest changed for {$id}; package quarantined.");
            }
            foreach ($manifest['files'] as $file) {
                $target = $file['target'];
                $this->assertTarget($target);
                if (isset($inventory[$target]) || file_exists(Files::path($stageRoot, $target))) {
                    throw new RuntimeException("{$id} cannot overwrite {$target}; it is owned by " . ($fileOwners[$target] ?? 'another source') . '. Use an exact declared patch.');
                }
                $bytes = Files::read(Files::path($packageRoot, $file['source']));
                $digest = hash('sha256', $bytes);
                if (!hash_equals($file['sha256'], $digest)) {
                    throw new RuntimeException("Frozen package payload changed: {$id}/{$file['source']}");
                }
                Files::atomic(Files::path($stageRoot, $target), $bytes, 0644);
                $inventory[$target] = $digest;
                $fileOwners[$target] = 'addon:' . $id;
                $ledger[] = ['addonId' => $id, 'kind' => 'file', 'target' => $target, 'originalOwner' => null, 'owner' => 'addon:' . $id, 'preSha256' => null, 'postSha256' => $digest, 'source' => $file['source']];
            }
            foreach ($manifest['patches'] as $patch) {
                $target = $patch['target'];
                $this->assertTarget($target);
                if (!isset($inventory[$target])) {
                    throw new RuntimeException("Patch {$id}/{$patch['id']} target is missing: {$target}");
                }
                $owner = $fileOwners[$target];
                $find = Files::read(Files::path($packageRoot, $patch['find']));
                $replace = Files::read(Files::path($packageRoot, $patch['replace']));
                if ($find === '' || !hash_equals($patch['beforeSha256'], hash('sha256', $find)) || !hash_equals($patch['afterSha256'], hash('sha256', $replace))) {
                    throw new RuntimeException("Patch fragment checksum mismatch: {$id}/{$patch['id']}");
                }
                $path = Files::path($stageRoot, $target);
                $before = Files::read($path);
                $first = strpos($before, $find);
                if ($first === false || strpos($before, $find, $first + 1) !== false) {
                    throw new RuntimeException("Patch {$id}/{$patch['id']} requires exactly one source fragment in {$target}.");
                }
                $end = $first + strlen($find);
                $parent = null;
                $effectiveOwner = $owner;
                foreach ($segments[$target] ?? [] as $segment) {
                    if ($first >= $segment['start'] && $end <= $segment['end'] && $patch['owner'] === 'addon:' . $segment['addonId']) {
                        $effectiveOwner = $patch['owner'];
                    }
                }
                if ($patch['owner'] !== $effectiveOwner && !($patch['owner'] === 'baseline' && !str_starts_with($effectiveOwner, 'addon:'))) {
                    throw new RuntimeException("Patch {$id}/{$patch['id']} expected owner {$patch['owner']}, actual fragment owner {$effectiveOwner}: {$target}");
                }
                if (str_starts_with($patch['owner'], 'addon:') && !in_array(substr($patch['owner'], 6), array_column($manifest['dependencies'], 'id'), true)) {
                    throw new RuntimeException("{$id} must declare its dependency before patching {$patch['owner']}.");
                }
                foreach ($segments[$target] ?? [] as $segment) {
                    // Track replaced spans in the current text, including zero-width deletions.
                    $overlap = ($first < $segment['end'] && $end > $segment['start']) || ($segment['start'] === $segment['end'] && $first <= $segment['start'] && $end >= $segment['end']);
                    if (!$overlap) {
                        continue;
                    }
                    $dependency = in_array($segment['addonId'], array_column($manifest['dependencies'], 'id'), true);
                    if (!$dependency || $patch['owner'] !== 'addon:' . $segment['addonId']) {
                        throw new RuntimeException("Overlapping patch {$id}/{$patch['id']} conflicts with {$segment['addonId']}/{$segment['patchId']} in {$target}.");
                    }
                    $parent = $segment['addonId'] . '/' . $segment['patchId'];
                }
                $after = substr($before, 0, $first) . $replace . substr($before, $end);
                $delta = strlen($replace) - strlen($find);
                $updatedSegments = [];
                foreach ($segments[$target] ?? [] as $segment) {
                    if ($segment['end'] <= $first) {
                        $updatedSegments[] = $segment;
                    } elseif ($segment['start'] >= $end) {
                        $segment['start'] += $delta;
                        $segment['end'] += $delta;
                        $updatedSegments[] = $segment;
                    } else {
                        if ($parent === null) {
                            throw new RuntimeException("Unverified patch composition in {$target}.");
                        }
                        if ($segment['start'] < $first) {
                            $left = $segment;
                            $left['end'] = $first;
                            $updatedSegments[] = $left;
                        }
                        if ($segment['end'] > $end) {
                            $right = $segment;
                            $right['start'] = $first + strlen($replace);
                            $right['end'] += $delta;
                            $updatedSegments[] = $right;
                        }
                    }
                }
                $updatedSegments[] = ['addonId' => $id, 'patchId' => $patch['id'], 'start' => $first, 'end' => $first + strlen($replace)];
                $segments[$target] = $updatedSegments;
                Files::atomic($path, $after, fileperms($path) & 0777);
                $inventory[$target] = hash('sha256', $after);
                $ledger[] = [
                    'addonId' => $id, 'kind' => 'patch', 'patchId' => $patch['id'], 'target' => $target,
                    'originalOwner' => $owner, 'owner' => $effectiveOwner, 'parentPatch' => $parent,
                    'preSha256' => hash('sha256', $before), 'postSha256' => $inventory[$target],
                    'beforeFragmentSha256' => hash('sha256', $find), 'afterFragmentSha256' => hash('sha256', $replace),
                    'offset' => $first, 'find' => base64_encode($find), 'replace' => base64_encode($replace),
                ];
            }
        }
        ksort($inventory, SORT_STRING);
        $actual = Files::inventory($stageRoot);
        if ($actual !== $inventory) {
            throw new RuntimeException('Composed stage contains undeclared changes.');
        }
        return ['inventory' => $inventory, 'ledger' => $ledger, 'owners' => $fileOwners];
    }

    public function assertTarget(string $target): void
    {
        Files::relative($target);
        (new Paths())->assertTarget($target);
        if (in_array($target, ['bootstrap/app.php', 'config/app.php', 'app/Providers/RouteServiceProvider.php'], true)) {
            throw new RuntimeException("Manager bootstrap registration is protected: {$target}");
        }
    }

    private function baselineOwner(string $path, array $owners, string $default): string
    {
        $matched = $default;
        $length = 0;
        foreach ($owners as $prefix => $owner) {
            $prefix = rtrim($prefix, '/');
            if (($path === $prefix || str_starts_with($path, $prefix . '/')) && strlen($prefix) > $length) {
                $matched = $owner;
                $length = strlen($prefix);
            }
        }
        return $matched;
    }
}
