<?php

namespace Pterodactyl\Helpers;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

final class ArixAddons
{
    public static function baseUrl(): string
    {
        return "https://arix.gg/arix-api/v1";
    }

    public static function licensedRequestToApi(
        string $route,
        array|null $queryParameters = [],
        bool $force = false,
        string $method = "GET",
        int $cacheHours = 6,
    ) {
        $url = self::baseUrl() . "/" . $route;
        $serviceUrl = $url . "?" . http_build_query($queryParameters);

        if (!$force) {
            $cachedRes = Cache::get($serviceUrl);
            if ($cachedRes) {
                return $cachedRes;
            }
        }

        $response = match ($method) {
            "POST" => Http::withHeaders([
                "license" => config("pluginsAddon.license"),
            ])->post($serviceUrl),
            "PUT" => Http::withHeaders([
                "license" => config("pluginsAddon.license"),
            ])->put($serviceUrl),
            "DELETE" => Http::withHeaders([
                "license" => config("pluginsAddon.license"),
            ])->delete($serviceUrl),
            default => Http::withHeaders([
                "license" => config("pluginsAddon.license"),
            ])->get($serviceUrl),
        };

        if ($response->status() == 200 && !$force) {
            Cache::put($serviceUrl, $response->json(), 60 * 60 * $cacheHours);
        }

        return $response->json();
    }
}
// aa0798e41bd9f700acff3f6c7a73d0ec
