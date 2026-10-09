<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixAdvancedRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Traits\Helpers\AvailableLanguages;

class ArixAdvancedController extends Controller
{
    use AvailableLanguages;

    /**
     * IndexController constructor.
     */
    public function __construct(
        private AlertsMessageBag $alert,
        private SettingsRepositoryInterface $settings,
        private ViewFactory $view
    ) {
    }

    private function responseData(): array
    {
        $languageOptions = json_decode(
            (string) $this->settings->get('settings::arix:advanced:languageOptions', '[{"key":"en","name":"English"}]'),
            true,
        );

        if (!is_array($languageOptions)) {
            $languageOptions = [['key' => 'en', 'name' => 'English']];
        }

        return [
            'profileType' => (string) $this->settings->get('settings::arix:advanced:profileType', 'gravatar'),
            'modeToggler' => filter_var($this->settings->get('settings::arix:advanced:modeToggler', true), FILTER_VALIDATE_BOOLEAN),
            'langSwitch' => filter_var($this->settings->get('settings::arix:advanced:langSwitch', true), FILTER_VALIDATE_BOOLEAN),
            'defaultLang' => (string) $this->settings->get('settings::arix:advanced:defaultLang', 'en'),
            'languageOptions' => $languageOptions,
            'availableLanguages' => $this->getAvailableLanguages(),
            'ipFlag' => filter_var($this->settings->get('settings::arix:advanced:ipFlag', true), FILTER_VALIDATE_BOOLEAN),
            'lowResourcesAlert' => filter_var($this->settings->get('settings::arix:advanced:lowResourcesAlert', false), FILTER_VALIDATE_BOOLEAN),
            'alertLink' => (string) $this->settings->get('settings::arix:advanced:alertLink', ''),
            'dashboardPage' => filter_var($this->settings->get('settings::arix:advanced:dashboardPage', true), FILTER_VALIDATE_BOOLEAN),
            'registration' => filter_var($this->settings->get('settings::arix:advanced:registration', false), FILTER_VALIDATE_BOOLEAN),
            'defaultMode' => (string) $this->settings->get('settings::arix:advanced:defaultMode', 'darkmode'),
            'copyright' => (string) $this->settings->get('settings::arix:advanced:copyright', 'Designed by Weijers.one'),

            'trashbin' => filter_var($this->settings->get('settings::arix:advanced:trashbin', true), FILTER_VALIDATE_BOOLEAN),
            'gracePeriod' => (int) $this->settings->get('settings::arix:advanced:gracePeriod', 7),

            'adminTheme' => filter_var($this->settings->get('settings::arix:advanced:adminTheme', true), FILTER_VALIDATE_BOOLEAN),

            'tierVisibility' => (string) $this->settings->get('settings::arix:advanced:tierVisibility', 'hidden'),

            'profileCustomization' => [
                'username' => filter_var($this->settings->get('settings::arix:advanced:profileCustomization:username', true), FILTER_VALIDATE_BOOLEAN),
                'name' => filter_var($this->settings->get('settings::arix:advanced:profileCustomization:name', true), FILTER_VALIDATE_BOOLEAN),
                'email' => filter_var($this->settings->get('settings::arix:advanced:profileCustomization:email', true), FILTER_VALIDATE_BOOLEAN),
            ],

            'subscription' => [
                'target' => (string) $this->settings->get('settings::arix:advanced:subscription:target', 'paymenter'),
                'endpoint' => (string) $this->settings->get('settings::arix:advanced:subscription:endpoint', ''),
                'identifier' => (string) $this->settings->get('settings::arix:advanced:subscription:identifier', ''),
                'secret' => (string) $this->settings->get('settings::arix:advanced:subscription:secret', ''),
                'alert' => filter_var($this->settings->get('settings::arix:advanced:subscription:alert', false), FILTER_VALIDATE_BOOLEAN),
            ]
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixAdvancedRequest $request)
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

            $languages = $this->getAvailableLanguages();
            $languageOptions = [];

            foreach (($payload['languageOptions'] ?? []) as $item) {
                if (is_string($item) && isset($languages[$item])) {
                    $languageOptions[] = [
                        'key' => $item,
                        'name' => $languages[$item],
                    ];
                }

                if (is_array($item) && isset($item['key']) && is_string($item['key']) && isset($languages[$item['key']])) {
                    $languageOptions[] = [
                        'key' => $item['key'],
                        'name' => $languages[$item['key']],
                    ];
                }
            }

            if (empty($languageOptions)) {
                $defaultLang = (string) ($payload['defaultLang'] ?? 'en');
                $languageOptions[] = [
                    'key' => $defaultLang,
                    'name' => $languages[$defaultLang] ?? 'English',
                ];
            }

            $languageOptionsJson = json_encode($languageOptions);
            if ($languageOptionsJson === false) {
                $languageOptionsJson = '[{"key":"en","name":"English"}]';
            }

            $settings = [
                'profileType' => (string) $payload['profileType'],
                'modeToggler' => filter_var($payload['modeToggler'], FILTER_VALIDATE_BOOLEAN),
                'langSwitch' => filter_var($payload['langSwitch'], FILTER_VALIDATE_BOOLEAN),
                'defaultLang' => (string) $payload['defaultLang'],
                'languageOptions' => $languageOptionsJson,
                'ipFlag' => filter_var($payload['ipFlag'], FILTER_VALIDATE_BOOLEAN),
                'lowResourcesAlert' => filter_var($payload['lowResourcesAlert'], FILTER_VALIDATE_BOOLEAN),
                'alertLink' => isset($payload['alertLink']) && $payload['alertLink'] !== '' ? (string) $payload['alertLink'] : null,
                'dashboardPage' => filter_var($payload['dashboardPage'], FILTER_VALIDATE_BOOLEAN),
                'registration' => filter_var($payload['registration'], FILTER_VALIDATE_BOOLEAN),
                'defaultMode' => (string) $payload['defaultMode'],
                'copyright' => (string) $payload['copyright'],

                'trashbin' => filter_var($payload['trashbin'], FILTER_VALIDATE_BOOLEAN),
                'gracePeriod' => (int) $payload['gracePeriod'],

                'adminTheme' => filter_var($payload['adminTheme'], FILTER_VALIDATE_BOOLEAN),

                'tierVisibility' => (string) $payload['tierVisibility'],

                'profileCustomization:username' => filter_var($payload['profileCustomization']['username'], FILTER_VALIDATE_BOOLEAN),
                'profileCustomization:name' => filter_var($payload['profileCustomization']['name'], FILTER_VALIDATE_BOOLEAN),
                'profileCustomization:email' => filter_var($payload['profileCustomization']['email'], FILTER_VALIDATE_BOOLEAN),

                'subscription:target' => (string) $payload['subscription']['target'],
                'subscription:endpoint' => isset($payload['subscription']['endpoint']) && $payload['subscription']['endpoint'] !== '' ? (string) $payload['subscription']['endpoint'] : null,
                'subscription:identifier' => isset($payload['subscription']['identifier']) && $payload['subscription']['identifier'] !== '' ? (string) $payload['subscription']['identifier'] : null,
                'subscription:secret' => isset($payload['subscription']['secret']) && $payload['subscription']['secret'] !== '' ? (string) $payload['subscription']['secret'] : null,
                'subscription:alert' => filter_var($payload['subscription']['alert'], FILTER_VALIDATE_BOOLEAN),
            ];

            foreach ($settings as $key => $value) {
                $this->settings->set('settings::arix:advanced:' . $key, $value);
            }

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
}