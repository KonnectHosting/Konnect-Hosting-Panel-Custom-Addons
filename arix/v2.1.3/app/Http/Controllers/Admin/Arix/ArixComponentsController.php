<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixComponentsRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixComponentsController extends Controller
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
            'serverRow' => (string) $this->settings->get('settings::arix:components:serverRow', 'default'),

            'statsCards' => (int) $this->settings->get('settings::arix:components:statsCards', 2),
            'sideGraphs' => (int) $this->settings->get('settings::arix:components:sideGraphs', 1),
            'graphs' => (int) $this->settings->get('settings::arix:components:graphs', 1),

            'titledBoxStyle' => (string) $this->settings->get('settings::arix:components:titledBoxStyle', 'default'),

            'statsStyle' => (string) $this->settings->get('settings::arix:components:statsStyle', 'default'),
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixComponentsRequest $request)
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
                'serverRow' => (string) $payload['serverRow'],
                'statsCards' => (int) $payload['statsCards'],
                'sideGraphs' => (int) $payload['sideGraphs'],
                'graphs' => (int) $payload['graphs'],

                'titledBoxStyle' => (string) $payload['titledBoxStyle'],
                'statsStyle' => (string) $payload['statsStyle'],
                'tableStyle' => (string) $payload['tableStyle'],
            ];

            foreach ($settings as $key => $value) {
                $this->settings->set('settings::arix:components:' . $key, $value);
            }

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
}