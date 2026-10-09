<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixLayoutRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixLayoutController extends Controller
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
            'layout' => (string) $this->settings->get('settings::arix:layout:layout', 'default'),
            'dock' => (string) $this->settings->get('settings::arix:layout:dock', 'sidebar'),
            'hoverEffect' => (string) $this->settings->get('settings::arix:layout:hoverEffect', 'default'),
            'searchComponent' => (string) $this->settings->get('settings::arix:layout:searchComponent', "Command Palette"),

            'logoPosition' => (string) $this->settings->get('settings::arix:layout:logoPosition', "top"),
            'socialPosition' => (string) $this->settings->get('settings::arix:layout:socialPosition', "top"),
            'loginLayout' => (string) $this->settings->get('settings::arix:layout:loginLayout', "default"),
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixLayoutRequest $request)
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
                'layout' => (string) $payload['layout'],
                'dock' => (string) $payload['dock'],
                'hoverEffect' => (string) $payload['hoverEffect'],
                'searchComponent' => (string) $payload['searchComponent'],
                'logoPosition' => (string) $payload['logoPosition'],
                'socialPosition' => (string) $payload['socialPosition'],
                'loginLayout' => (string) $payload['loginLayout'],
            ];

            foreach ($settings as $key => $value) {
                $this->settings->set('settings::arix:layout:' . $key, $value);
            }

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
}