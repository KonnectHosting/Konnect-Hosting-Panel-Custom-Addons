<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\View\View;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixMailRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixMailController extends Controller
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
            'editor' => (string) $this->settings->get('settings::arix:mail:editor', 'simple'),

            'logo' => (string) $this->settings->get('settings::arix:mail:logo', 'https://arix.gg/arix.png'),
            'logoFull' => filter_var($this->settings->get('settings::arix:mail:logoFull', false), FILTER_VALIDATE_BOOLEAN),

            'editorCode' => (string) $this->settings->get('settings::arix:mail:editorCode', ''),
            'editorJson' => (string) $this->settings->get('settings::arix:mail:editorJson', ''),

            'developerCode' => (string) $this->settings->get('settings::arix:mail:developerCode', ''),

            'template' => (string) $this->settings->get('settings::arix:mail:template', 'default'),
            'color' => (string) $this->settings->get('settings::arix:mail:color', '#4d35eb'),

            'status' => $this->settings->get('settings::arix:mail:status', 'https://arix.gg/status'),
            'billing' => $this->settings->get('settings::arix:mail:billing', 'https://arix.gg/billing'),
            'support' => $this->settings->get('settings::arix:mail:support', 'https://arix.gg/support'),
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixMailRequest $request)
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
                'editor' => (string) $payload['editor'],

                'logo' => (string) $payload['logo'],
                'logoFull' => filter_var($payload['logoFull'], FILTER_VALIDATE_BOOLEAN),

                'editorCode' => (string) $payload['editorCode'],
                'editorJson' => (string) $payload['editorJson'],

                'developerCode' => (string) $payload['developerCode'],

                'template' => (string) $payload['template'],
                'color' => (string) $payload['color'],

                'status' => isset($payload['status']) && $payload['status'] !== '' ? (string) $payload['status'] : null,
                'billing' => isset($payload['billing']) && $payload['billing'] !== '' ? (string) $payload['billing'] : null,
                'support' => isset($payload['support']) && $payload['support'] !== '' ? (string) $payload['support'] : null,
            ];

            foreach ($settings as $key => $value) {
                $this->settings->set('settings::arix:mail:' . $key, $value);
            }

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
}