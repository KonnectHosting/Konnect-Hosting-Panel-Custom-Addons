<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixPresetRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixPresetController extends Controller
{
    private const MAX_PRESET_KEYS = 150;

    private array $allowedKeyPrefixes = [
        'general.',
        'announcement.',
        'styling.',
        'layout.',
        'components.',
        'dashboardWidgets.',
        'colors.',
        'meta.',
        'social.',
        'links.',
        'advanced.',
        'mail.',
    ];

    // Keys that are never imported from presets, even when their prefix is whitelisted.
    // Add any sensitive setting here to prevent preset files from overwriting it.
    private array $blockedKeys = [
        'advanced.subscription.endpoint',
        'advanced.subscription.identifier',
        'advanced.subscription.secret',
        'advanced.registration',
        'announcement.ctaLink',
        'mail.developerCode',
        'mail.editorCode',
        'mail.editorJson',
    ];
    
    private array $jsonValueKeys = [
        'dashboardWidgets',
        'links',
        'social.socials',
        'advanced.languageOptions',
    ];

    public function __construct(
        private AlertsMessageBag $alert,
        private SettingsRepositoryInterface $settings,
    ) {
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        $response = Http::get('https://arix.gg/internal/api/marketplace');

        return response()->json([
            'success' => $response->successful(),
            'data' => $response->json(),
        ]);
    }
    /**
     * Flatten a nested array to dot notation.
     * Example: ['general' => ['logo' => '/path']] => ['general.logo' => '/path']
     */
    private function flattenArray(array $array, string $prefix = ''): array
    {
        $result = [];
        
        foreach ($array as $key => $value) {
            $fullKey = $prefix ? "{$prefix}.{$key}" : $key;
            
            if (is_array($value)) {
                if (in_array($fullKey, $this->jsonValueKeys, true)) {
                    $result[$fullKey] = $value;
                } else {
                    $result = array_merge($result, $this->flattenArray($value, $fullKey));
                }
            } else {
                $result[$fullKey] = $value;
            }
        }
        
        return $result;
    }

            private function rgbToHex(string $value): string
            {
                $parts = preg_split('/\s+/', trim($value));

                if ($parts === false || count($parts) !== 3) {
                    return $value;
                }

                foreach ($parts as $part) {
                    if (!is_numeric($part)) {
                        return $value;
                    }
                }

                return sprintf('#%02x%02x%02x', (int) $parts[0], (int) $parts[1], (int) $parts[2]);
            }

            private function isWhitelistedKey(string $key): bool
            {
                if (in_array($key, $this->jsonValueKeys, true)) {
                    return true;
                }

                foreach ($this->allowedKeyPrefixes as $prefix) {
                    if (str_starts_with($key, $prefix)) {
                        return true;
                    }
                }

                return false;
            }

    /**
     * Import a preset JSON and save all settings dynamically.
     */
    public function import(ArixPresetRequest $request): \Illuminate\Http\JsonResponse
    {
        try {
            $licensed = Cache::remember('arix_license_valid', 3600, function () {
                $response = Http::asForm()->post('https://arix.gg/license/arix-theme', [
                    'license' => config('arixTheme.license'),
                ]);
                return (bool) ($response->json()['success'] ?? false);
            });

            if (!$licensed) {
                return response()->json([
                    'success' => false,
                    'message' => 'License validation failed',
                ], 403);
            }

            $incomingPreset = $request->validated()['preset'] ?? [];
            
            $incomingFlat = $this->flattenArray($incomingPreset);

            if (count($incomingFlat) > self::MAX_PRESET_KEYS) {
                return response()->json([
                    'success' => false,
                    'message' => 'Preset exceeds maximum allowed keys (' . self::MAX_PRESET_KEYS . ').',
                ], 422);
            }
            
            $imported = 0;
            $updated = [];
            
            foreach ($incomingFlat as $key => $value) {
                if (!$this->isWhitelistedKey($key) || in_array($key, $this->blockedKeys, true)) {
                    continue;
                }

                if (str_starts_with($key, 'colors.') && is_string($value)) {
                    $value = $this->rgbToHex($value);
                }
                
                $convertedValue = $this->convertValue($value);
                
                $dbKey = str_replace('.', ':', $key);
                $this->settings->set("settings::arix:{$dbKey}", $convertedValue);
                $updated[$key] = $convertedValue;
                $imported++;
            }
            
            return response()->json([
                'success' => true,
                'message' => "Imported {$imported} settings successfully.",
                'imported' => $imported,
                'updated' => $updated,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to import preset: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Convert a value to the appropriate type for storage.
     * Simply converts the incoming format to what the database expects (strings).
     */
    private function convertValue($incomingValue): mixed
    {
        if ($incomingValue === null) {
            return null;
        }

        if (is_bool($incomingValue)) {
            return $incomingValue ? 'true' : 'false';
        }

        if (is_array($incomingValue) || is_object($incomingValue)) {
            return json_encode($incomingValue);
        }

        return (string) $incomingValue;
    }
}
