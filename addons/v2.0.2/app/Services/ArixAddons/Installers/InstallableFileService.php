<?php

namespace Pterodactyl\Services\ArixAddons\Installers;

use Pterodactyl\Helpers\ArixAddons;

class InstallableFileService
{
    public function qualifyUrl(string $url): string {
        return preg_match('#^https?://#i', $url)
            ? $url
            : rtrim(ArixAddons::baseUrl(), '/') . '/' . ltrim($url, '/');
    }

    public function extensionFromUrl(string $url): string {
        return strtolower(pathinfo(parse_url($url, PHP_URL_PATH) ?? $url, PATHINFO_EXTENSION));
    }

    public function buildFilename(string $name, string $version, string $extension, string $fallback): string {
        $base = trim($this->sanitizeSegment($name) . '-' . $this->sanitizeSegment($version), '-');

        return ($base !== '' ? $base : $fallback) . '.' . ltrim($extension, '.');
    }

    public function sanitizeSegment(string $value): string {
        $sanitized = preg_replace('/[^A-Za-z0-9._-]+/', '-', $value) ?? '';

        return trim($sanitized, '-');
    }
}
