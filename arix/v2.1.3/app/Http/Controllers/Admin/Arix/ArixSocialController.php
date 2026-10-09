<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixSocialRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixSocialController extends Controller
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

    /**
     * @return array{socials: array<int, mixed>, socialButtons: bool, discordBox: bool}
     */
    private function responseData(): array
    {
        $socials = json_decode((string) $this->settings->get('settings::arix:social:socials', '[]'), true);
        if (!is_array($socials)) {
            $socials = [];
        }

        return [
            'socials' => $socials,
            'socialButtons' => filter_var($this->settings->get('settings::arix:social:socialButtons', false), FILTER_VALIDATE_BOOLEAN),
            'discordBox' => filter_var($this->settings->get('settings::arix:social:discordBox', true), FILTER_VALIDATE_BOOLEAN),
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixSocialRequest $request)
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

            $socials = $payload['socials'] ?? [];
            if (!is_array($socials)) {
                $socials = [];
            }

            $socials = array_values(array_filter($socials, fn($item) => is_array($item) && !empty($item)));
            $socialsJson = json_encode($socials);
            if ($socialsJson === false) {
                $socialsJson = '[]';
            }

            $settings = [
                'socials' => $socialsJson,
                'socialButtons' => filter_var($payload['socialButtons'], FILTER_VALIDATE_BOOLEAN),
                'discordBox' => filter_var($payload['discordBox'], FILTER_VALIDATE_BOOLEAN),
            ];

            foreach ($settings as $key => $value) {
                $this->settings->set('settings::arix:social:' . $key, $value);
            }

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
}