<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixController extends Controller
{
    /**
     * IndexController constructor.
     */
    public function __construct(
        private AlertsMessageBag $alert,
        private SettingsRepositoryInterface $settings,
        private ViewFactory $view
    ) {
    }

    private function responseData() {
        return [
            'logo' => (string) $this->settings->get('settings::arix:general:logo', '/arix/Arix.png'),
            'logoLight' => (string) $this->settings->get('settings::arix:general:logoLight', '/arix/Arix.png'),
            'fullLogo' => filter_var($this->settings->get('settings::arix:general:fullLogo', false), FILTER_VALIDATE_BOOLEAN),
            'logoHeight' => (int) $this->settings->get('settings::arix:general:logoHeight', 32),
            'discord' => (string) $this->settings->get('settings::arix:general:discord', '715281172422197300'),
            'support' => (string) $this->settings->get('settings::arix:general:support', 'https://discord.gg/geCjrRbAwC'),
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixRequest $request)
    {
        $licensed = Cache::remember('arix_license_valid', 3600, function () {
            $response = AASupport::asForm()->post('https://arix.gg/license/arix-theme', [
                'license' => config('arixTheme.license'),
            ]);
            return (bool) ($response->json()['success'] ?? false);
        });

        if (!$licensed) {
            $this->alert->warning('Something went wrong.')->flash();
            throw new \Exception( 'Something went wrong');
        } else {
            $payload = $request->validated();

            $settings = [
                'logo' => (string) $payload['logo'],
                'logoLight' => (string) $payload['logoLight'],
                'fullLogo' => filter_var($payload['fullLogo'], FILTER_VALIDATE_BOOLEAN),
                'logoHeight' => (int) $payload['logoHeight'],
                'discord' => isset($payload['discord']) && $payload['discord'] !== '' ? (string) $payload['discord'] : null,
                'support' => isset($payload['support']) && $payload['support'] !== '' ? (string) $payload['support'] : null,
            ];

            foreach ($settings as $key => $value) {
                $this->settings->set('settings::arix:general:' . $key, $value);
            }

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
    
}