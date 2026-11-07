<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use AddonManager\Laravel\ExtensionRegistry;
use Illuminate\Http\Request;

final class Enabled
{
    public function handle(Request $request, \Closure $next): mixed
    {
        $manifest = app(ExtensionRegistry::class)->enabled()['gmod.toolkit'] ?? null;
        abort_unless(($manifest['version'] ?? null) === '1.3.0', 404);
        return $next($request);
    }
}
