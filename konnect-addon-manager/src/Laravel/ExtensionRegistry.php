<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Laravel;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Request;
use Konnect\AddonManager\Core\ManifestValidator;
use Pterodactyl\Http\Middleware\AdminAuthenticate;
use Pterodactyl\Http\Middleware\RequireTwoFactorAuthentication;
use RuntimeException;

/** Declarative registrations never load a PHP installer or an addon service provider. */
final class ExtensionRegistry
{
    public function __construct(private readonly object $app, private readonly HostAdapter $host)
    {
    }

    public function enabled(): array
    {
        $candidate = PHP_SAPI === 'cli' && defined('KONNECT_ADDON_MANAGER_READINESS') && defined('KONNECT_ADDON_MANAGER_CANDIDATE_REGISTRY') ? KONNECT_ADDON_MANAGER_CANDIDATE_REGISTRY : null;
        if ($candidate !== null) {
            if (realpath($candidate) !== realpath($this->host->stateRoot . '/candidate-registry.json') || !is_file($candidate)) {
                throw new RuntimeException('Invalid readiness candidate registry path.');
            }
            $registry = json_decode((string) file_get_contents($candidate), true, 512, JSON_THROW_ON_ERROR);
        } elseif (!is_file($this->host->stateRoot . '/registry.json')) {
            return [];
        } else {
            $registry = $this->host->manager()->registry();
        }
        $enabled = [];
        foreach (($registry['addons'] ?? []) as $id => $record) {
            if (($record['enabled'] ?? false) !== true) {
                continue;
            }
            $manifest = ManifestValidator::validate($record['manifest']);
            if ($manifest['id'] !== $id || $manifest['version'] !== $record['version']) {
                throw new RuntimeException('Extension registry identity mismatch: ' . $id);
            }
            $enabled[$id] = $manifest;
        }
        return $enabled;
    }

    public function guard(string $id, string $version, string $permission, ?Request $request = null): array
    {
        $manifest = $this->enabled()[$id] ?? null;
        if ($manifest === null || $manifest['version'] !== $version) {
            abort(404, 'This addon version is no longer enabled.');
        }
        if ($permission === 'admin') {
            $user = ($request ?? request())->user();
            if (!$user || !$user->root_admin) {
                abort(403);
            }
        } elseif ($permission !== 'system' || $request !== null) {
            abort(403);
        }
        return $manifest;
    }

    public function registerRoutes(): void
    {
        if ($this->app->routesAreCached()) {
            return;
        }
        foreach ($this->enabled() as $id => $manifest) {
            foreach (['pages', 'routes'] as $kind) {
                foreach ($manifest['extensions'][$kind] ?? [] as $extension) {
                    $path = 'admin/konnect-addons/extensions/' . $id . '/' . ltrim($extension['path'], '/');
                    $method = $kind === 'pages' ? 'GET' : $extension['method'];
                    $route = $this->app['router']->match([$method], $path, [ExtensionController::class, 'dispatch'])
                        ->middleware(['web', 'auth.session', RequireTwoFactorAuthentication::class, AdminAuthenticate::class])
                        ->name('admin.konnect-addons.extensions.' . $id . '.' . $extension['id']);
                    $route->defaults('__konnectAddonId', $id);
                    $route->defaults('__konnectAddonVersion', $manifest['version']);
                    $route->defaults('__konnectExtensionKind', $kind);
                    $route->defaults('__konnectExtensionId', $extension['id']);
                }
            }
        }
    }

    public function dispatch(Request $request): mixed
    {
        $route = $request->route();
        $id = (string) $route->parameter('__konnectAddonId');
        $version = (string) $route->parameter('__konnectAddonVersion');
        $manifest = $this->guard($id, $version, 'admin', $request);
        $kind = (string) $route->parameter('__konnectExtensionKind');
        $extensionId = (string) $route->parameter('__konnectExtensionId');
        foreach ($manifest['extensions'][$kind] ?? [] as $extension) {
            if ($extension['id'] !== $extensionId) {
                continue;
            }
            if ($extension['permission'] !== 'admin') {
                abort(403);
            }
            if ($kind === 'pages') {
                return view($extension['view'], ['addon' => $manifest, 'addonPage' => $extension]);
            }
            return $this->invoke($extension['handler'], ['request' => $request]);
        }
        abort(404);
    }

    public function registerEvents(): void
    {
        foreach ($this->enabled() as $id => $manifest) {
            foreach ($manifest['extensions']['events'] ?? [] as $extension) {
                $version = $manifest['version'];
                $this->app['events']->listen($extension['event'], function (...$payload) use ($id, $version, $extension): mixed {
                    if (!$this->systemEnabled($id, $version)) {
                        return null;
                    }
                    return $this->invoke($extension['handler'], ['event' => $payload[0] ?? null, 'payload' => $payload]);
                });
            }
        }
    }

    public function registerSchedules(Schedule $schedule): void
    {
        foreach ($this->enabled() as $id => $manifest) {
            foreach ($manifest['extensions']['schedules'] ?? [] as $extension) {
                $version = $manifest['version'];
                $event = $schedule->call(function () use ($id, $version, $extension): mixed {
                    if (!$this->systemEnabled($id, $version)) {
                        return null;
                    }
                    return $this->invoke($extension['handler']);
                })->name('konnect-addon:' . $id . ':' . $extension['id'])->withoutOverlapping();
                $event->{$extension['frequency']}();
            }
        }
    }

    public function dispatchJob(string $id, string $version, string $jobId, array $payload = []): mixed
    {
        self::assertJobPayload($payload);
        $manifest = $this->guard($id, $version, 'system');
        foreach ($manifest['extensions']['jobs'] ?? [] as $job) {
            if ($job['id'] === $jobId && $job['permission'] === 'system') {
                return $this->app['bus']->dispatch(new AddonJob($id, $version, $jobId, $payload));
            }
        }
        throw new RuntimeException('Unknown enabled addon job registration.');
    }

    public function runJob(string $id, string $version, string $jobId, array $payload = []): mixed
    {
        self::assertJobPayload($payload);
        if (!$this->systemEnabled($id, $version)) {
            return null;
        }
        $manifest = $this->enabled()[$id];
        foreach ($manifest['extensions']['jobs'] ?? [] as $job) {
            if ($job['id'] === $jobId && $job['permission'] === 'system') {
                return $this->invoke($job['handler'], ['payload' => $payload]);
            }
        }
        return null;
    }

    public function maintenance(): bool
    {
        return $this->app->isDownForMaintenance();
    }

    public static function assertJobPayload(array $payload): void
    {
        $walk = static function (mixed $value, int $depth = 0) use (&$walk): void {
            if ($depth > 20) {
                throw new RuntimeException('Addon job payload nesting exceeds the limit.');
            }
            if (is_array($value)) {
                foreach ($value as $entry) {
                    $walk($entry, $depth + 1);
                }
            } elseif ($value !== null && !is_scalar($value)) {
                throw new RuntimeException('Addon job payload must contain plain JSON data.');
            }
        };
        $walk($payload);
        if (strlen(json_encode($payload, JSON_THROW_ON_ERROR)) > 65536) {
            throw new RuntimeException('Addon job payload exceeds 64 KiB.');
        }
    }

    public function menus(): array
    {
        $user = $this->app['auth']->user();
        if (!$user || !$user->root_admin) {
            return [];
        }
        $menus = [];
        foreach ($this->enabled() as $id => $manifest) {
            $pages = array_column($manifest['extensions']['pages'] ?? [], null, 'id');
            foreach ($manifest['extensions']['menus'] ?? [] as $menu) {
                $page = $pages[$menu['page']] ?? null;
                if ($page !== null && $page['permission'] === 'admin') {
                    $menus[] = ['id' => $id . ':' . $menu['id'], 'label' => $menu['label'], 'url' => url('/admin/konnect-addons/extensions/' . $id . '/' . $page['path'])];
                }
            }
        }
        return $menus;
    }

    private function systemEnabled(string $id, string $version): bool
    {
        // A long-lived event/schedule process re-reads committed registry state each time.
        $manifest = $this->enabled()[$id] ?? null;
        return $manifest !== null && $manifest['version'] === $version && !$this->maintenance();
    }

    private function invoke(string $handler, array $arguments = []): mixed
    {
        [$class, $method] = explode('@', $handler, 2);
        if (!str_starts_with($class, 'Pterodactyl\\Addons\\') || !preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/D', $method)) {
            throw new RuntimeException('Invalid extension handler.');
        }
        return $this->app->call([$this->app->make($class), $method], $arguments);
    }
}
