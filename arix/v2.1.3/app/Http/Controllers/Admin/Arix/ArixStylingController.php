<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixStylingRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixStylingController extends Controller
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
            'pageTitle' => filter_var($this->settings->get('settings::arix:styling:pageTitle', true), FILTER_VALIDATE_BOOLEAN),

            'background' => filter_var($this->settings->get('settings::arix:styling:background', false), FILTER_VALIDATE_BOOLEAN),
            'backgroundImage' => (string) $this->settings->get('settings::arix:styling:backgroundImage', ''),
            'backgroundImageLight' => (string) $this->settings->get('settings::arix:styling:backgroundImageLight', ''),
            'loginBackground' => (string) $this->settings->get('settings::arix:styling:loginBackground', '/arix/background-login.png'),
            'backgroundFaded' => (string) $this->settings->get('settings::arix:styling:backgroundFaded', 'default'),

            'backdrop' => filter_var($this->settings->get('settings::arix:styling:backdrop', false), FILTER_VALIDATE_BOOLEAN),
            'backdropPercentage' => (int) $this->settings->get('settings::arix:styling:backdropPercentage', 100),

            'radiusInput' => (int) $this->settings->get('settings::arix:styling:radiusInput', 7),
            'radiusBox' => (int) $this->settings->get('settings::arix:styling:radiusBox', 10),

            'borderInput' => filter_var($this->settings->get('settings::arix:styling:borderInput', true), FILTER_VALIDATE_BOOLEAN),
            'borderBox' => filter_var($this->settings->get('settings::arix:styling:borderBox', true), FILTER_VALIDATE_BOOLEAN),

            'clickEffect' => (string) $this->settings->get('settings::arix:styling:clickEffect', 'drop'),
            'pageTransition' => (string) $this->settings->get('settings::arix:styling:pageTransition', 'fadeUp'),

            'flashMessage' => (int) $this->settings->get('settings::arix:styling:flashMessage', 0),

            'font' => (string) $this->settings->get('settings::arix:styling:font', 'default'),
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixStylingRequest $request)
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
                'pageTitle' => filter_var($payload['pageTitle'], FILTER_VALIDATE_BOOLEAN),

                'background' => filter_var($payload['background'], FILTER_VALIDATE_BOOLEAN),
                'backgroundImage' => isset($payload['backgroundImage']) && $payload['backgroundImage'] !== '' ? (string) $payload['backgroundImage'] : null,
                'backgroundImageLight' => isset($payload['backgroundImageLight']) && $payload['backgroundImageLight'] !== '' ? (string) $payload['backgroundImageLight'] : null,
                'loginBackground' => isset($payload['loginBackground']) && $payload['loginBackground'] !== '' ? (string) $payload['loginBackground'] : null,
                'backgroundFaded' => (string) $payload['backgroundFaded'],

                'backdrop' => filter_var($payload['backdrop'], FILTER_VALIDATE_BOOLEAN),
                'backdropPercentage' => (int) $payload['backdropPercentage'],

                'radiusInput' => (int) $payload['radiusInput'],
                'radiusBox' => (int) $payload['radiusBox'],

                'borderInput' => filter_var($payload['borderInput'], FILTER_VALIDATE_BOOLEAN),
                'borderBox' => filter_var($payload['borderBox'], FILTER_VALIDATE_BOOLEAN),

                'clickEffect' => (string) $payload['clickEffect'],
                'pageTransition' => (string) $payload['pageTransition'],

                'flashMessage' => (int) $payload['flashMessage'],

                'font' => (string) $payload['font'],
            ];

            foreach ($settings as $key => $value) {
                $this->settings->set('settings::arix:styling:' . $key, $value);
            }

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
}