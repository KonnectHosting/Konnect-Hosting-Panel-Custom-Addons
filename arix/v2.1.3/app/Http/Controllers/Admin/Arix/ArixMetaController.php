<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixMetaRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixMetaController extends Controller
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
            'index' => filter_var($this->settings->get('settings::arix:meta:index', true), FILTER_VALIDATE_BOOLEAN),
            'color' => (string) $this->settings->get('settings::arix:meta:color', '#4d35eb'),
            'title' => (string) $this->settings->get('settings::arix:meta:title', 'Pterodactyl Panel'),
            'description' => (string) $this->settings->get('settings::arix:meta:description', 'Our official Pterodactyl panel'),
            'image' => (string) $this->settings->get('settings::arix:meta:image', '/arix/meta-tags.png'),
            'favicon' => (string) $this->settings->get('settings::arix:meta:favicon', '/arix/Arix.png'),
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixMetaRequest $request)
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
                'index' => filter_var($payload['index'], FILTER_VALIDATE_BOOLEAN),
                'color' => (string) $payload['color'],
                'title' => (string) $payload['title'],
                'description' => (string) $payload['description'],
                'image' => (string) $payload['image'],
                'favicon' => (string) $payload['favicon'],
            ];

            foreach ($settings as $key => $value) {
                $this->settings->set('settings::arix:meta:' . $key, $value);
            }

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
}