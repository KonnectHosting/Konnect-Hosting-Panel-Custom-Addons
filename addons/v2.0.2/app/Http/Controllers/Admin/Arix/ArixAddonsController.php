<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixAddonsRequest;
use Pterodactyl\Http\ViewComposers\AddonsConfiguration;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixAddonsController extends Controller
{
    public function __construct(
        private AlertsMessageBag $alert,
        private SettingsRepositoryInterface $settings,
        private ViewFactory $view,
        private AddonsConfiguration $addonsConfiguration
    ) {
    }

    public function index(): JsonResponse
    {
        return response()->json($this->addonsConfiguration->getConfiguration());
    }

    public function show(string $addon): JsonResponse
    {
        $definitions = AddonsConfiguration::definitions();

        abort_unless(isset($definitions[$addon]), 404);

        return response()->json($this->addonsConfiguration->getAddon($addon));
    }

    public function store(ArixAddonsRequest $request, string $addon): JsonResponse
    {
        $licensed = Cache::remember('arix_license_valid', 3600, function () {
            $response = AASupport::asForm()->post('https://arix.gg/license/addon-pack', [
                'license' => config('pluginsAddon.license'),
            ]);
            return (bool) ($response->json()['success'] ?? false);
        });

        if (!$licensed) {
            $this->alert->warning('Something went wrong.')->flash();
            throw new \Exception('Something went wrong');
        }

        $payload = $request->validated();
        $fields = AddonsConfiguration::definitions()[$addon];

        foreach ($fields as $fieldKey => $fieldDef) {
            $value = $payload[$fieldKey] ?? $fieldDef['default'];
            $settingKey = "settings::arix:addons:{$addon}:{$fieldKey}";

            $this->settings->set($settingKey, match ($fieldDef['type']) {
                'boolean' => filter_var($value, FILTER_VALIDATE_BOOLEAN),
                'array'   => json_encode(array_values(array_map('intval', (array) $value))),
                // Preserve the id => [ids] structure; only 'array' is flattened to a plain list.
                'map'     => json_encode(
                    collect((array) $value)->mapWithKeys(
                        fn ($destinations, $source) => [(int) $source => array_values(array_map('intval', (array) $destinations))]
                    )->all()
                ),
                'number'  => (int) $value,
                default   => (string) $value,
            });
        }

        $this->alert->success('Addon settings have been updated successfully.')->flash();

        return response()->json($this->addonsConfiguration->getAddon($addon));
    }
}
