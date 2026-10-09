<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Illuminate\View\Factory as ViewFactory;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixColorsRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixColorsController extends Controller
{
    /**
     * @return array<int, string>
     */
    private function colorKeys(): array
    {
        return [
            'primary',
            'successText',
            'successBorder',
            'successBackground',
            'dangerText',
            'dangerBorder',
            'dangerBackground',
            'secondaryText',
            'secondaryBorder',
            'secondaryBackground',
            'gray50',
            'gray100',
            'gray200',
            'gray300',
            'gray400',
            'gray500',
            'gray600',
            'gray700',
            'gray800',
            'gray900',
        ];
    }

    /**
     * @return array<string, string>
     */
    private function modeDefaults(string $mode): array
    {
        return [
            'primary' => '#4d35eb',
            'successText' => '#E1FFD8',
            'successBorder' => '#2bab32',
            'successBackground' => '#1f8f2b',
            'dangerText' => '#FFD8D8',
            'dangerBorder' => '#ab2b40',
            'dangerBackground' => '#8f1f37',
            'secondaryText' => $mode === 'dark' ? '#B2B2C1' : '#46464D',
            'secondaryBorder' => $mode === 'dark' ? '#3c3c5d' : '#C0C0D3',
            'secondaryBackground' => $mode === 'dark' ? '#2b2b48' : '#A6A7BD',
            'gray50' => $mode === 'dark' ? '#F4F4F4' : '#141415',
            'gray100' => $mode === 'dark' ? '#D5D5DB' : '#27272C',
            'gray200' => $mode === 'dark' ? '#B2B2C1' : '#46464D',
            'gray300' => $mode === 'dark' ? '#8282A4' : '#626272',
            'gray400' => $mode === 'dark' ? '#5E5E7F' : '#757689',
            'gray500' => $mode === 'dark' ? '#3c3c5d' : '#A6A7BD',
            'gray600' => $mode === 'dark' ? '#2b2b48' : '#C0C0D3',
            'gray700' => $mode === 'dark' ? '#1a1a2f' : '#E7E7EF',
            'gray800' => $mode === 'dark' ? '#0c0d21' : '#F0F1F5',
            'gray900' => $mode === 'dark' ? '#040519' : '#FFFFFF',
        ];
    }

    /**
     * @return array<string, string>
     */
    private function colorGroup(string $mode): array
    {
        $defaults = $this->modeDefaults($mode);
        $values = [];

        foreach ($this->colorKeys() as $key) {
            $values[$key] = (string) $this->settings->get("settings::arix:colors:$mode:$key", $defaults[$key]);
        }

        return $values;
    }

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
            'dark' => $this->colorGroup('dark'),
            'light' => $this->colorGroup('light'),
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixColorsRequest $request)
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

            foreach (['dark', 'light'] as $mode) {
                foreach ($this->colorKeys() as $key) {
                    $this->settings->set("settings::arix:colors:$mode:$key", (string) $payload[$mode][$key]);
                }
            }

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
}