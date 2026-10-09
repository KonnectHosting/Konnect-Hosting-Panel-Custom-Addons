<?php

declare(strict_types=1);

namespace AddonManager\Lifecycle;

use AddonManager\Core\VersionMatcher;
use RuntimeException;

final class DependencyPlanner
{
    public function order(array $addons, array $host): array
    {
        $enabled = array_filter($addons, static fn (array $addon): bool => $addon['enabled']);
        ksort($enabled, SORT_STRING);
        foreach ($enabled as $id => $addon) {
            $manifest = $addon['manifest'];
            foreach ($manifest['compatibility'] as $product => $constraint) {
                if (!isset($host[$product]) || !$this->matches((string) $host[$product], $constraint)) {
                    throw new RuntimeException("{$id} is incompatible with {$product}: requires {$constraint}, host " . ($host[$product] ?? 'unknown'));
                }
            }
            foreach ($manifest['dependencies'] as $dependency) {
                $target = $enabled[$dependency['id']] ?? null;
                if ($target === null) {
                    throw new RuntimeException("{$id} requires enabled dependency {$dependency['id']} ({$dependency['version']}).");
                }
                if (!$this->matches($target['version'], $dependency['version'])) {
                    throw new RuntimeException("{$id} requires {$dependency['id']} {$dependency['version']}; installed {$target['version']}.");
                }
            }
            foreach ($manifest['incompatible'] as $conflict) {
                if (isset($enabled[$conflict['id']]) && $this->matches($enabled[$conflict['id']]['version'], $conflict['version'])) {
                    throw new RuntimeException("{$id} conflicts with enabled addon {$conflict['id']}.");
                }
            }
        }
        $state = [];
        $order = [];
        $visit = function (string $id, array $trail) use (&$visit, &$state, &$order, $enabled): void {
            if (($state[$id] ?? null) === 'visiting') {
                throw new RuntimeException('Dependency cycle: ' . implode(' -> ', [...$trail, $id]));
            }
            if (($state[$id] ?? null) === 'done') {
                return;
            }
            $state[$id] = 'visiting';
            $dependencies = array_column($enabled[$id]['manifest']['dependencies'], 'id');
            sort($dependencies, SORT_STRING);
            foreach ($dependencies as $dependency) {
                $visit($dependency, [...$trail, $id]);
            }
            $state[$id] = 'done';
            $order[] = $id;
        };
        foreach (array_keys($enabled) as $id) {
            $visit($id, []);
        }
        return $order;
    }

    public function dependents(array $addons, string $id, bool $enabledOnly = true): array
    {
        $found = [];
        $frontier = [$id];
        while ($frontier !== []) {
            $dependencyId = array_shift($frontier);
            foreach ($addons as $candidate => $addon) {
                if ($candidate === $id || isset($found[$candidate]) || ($enabledOnly && !$addon['enabled'])) {
                    continue;
                }
                if (in_array($dependencyId, array_column($addon['manifest']['dependencies'], 'id'), true)) {
                    $found[$candidate] = true;
                    $frontier[] = $candidate;
                }
            }
        }
        $ids = array_keys($found);
        sort($ids, SORT_STRING);
        return $ids;
    }

    private function matches(string $version, string $constraint): bool
    {
        return (new VersionMatcher())->matches($version, $constraint);
    }
}
