<?php

namespace Pterodactyl\Http\Controllers\Admin\Arix;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http as AASupport;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Arix\ArixLinkRequest;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;

class ArixLinkController extends Controller
{
    /**
     * IndexController constructor.
     */
    public function __construct(
        private AlertsMessageBag $alert,
        private SettingsRepositoryInterface $settings
    ) {
    }

    private function defaultLinks(): array
    {
        return [
            'general' => [
                'name' => 'general',
                'permission' => [],
                'nests' => [],
                'eggs' => [],
                'active' => true,
                'links' => [
                    [
                        'icon' => 'HiOutlineViewGrid',
                        'name' => 'dashboard',
                        'url' => '/',
                        'permission' => [],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineTerminal',
                        'name' => 'console',
                        'url' => '/console',
                        'permission' => [],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineCog',
                        'name' => 'settings',
                        'url' => '/settings',
                        'permission' => ['settings.*', 'file.sftp'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineEye',
                        'name' => 'activity',
                        'url' => '/activity',
                        'permission' => ['activity.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                ],
            ],
            'management' => [
                'name' => 'management',
                'permission' => [],
                'nests' => [],
                'eggs' => [],
                'active' => true,
                'links' => [
                    [
                        'icon' => 'HiOutlineFolderOpen',
                        'name' => 'files',
                        'url' => '/files',
                        'permission' => ['file.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineDatabase',
                        'name' => 'databases',
                        'url' => '/databases',
                        'permission' => ['database.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineArchive',
                        'name' => 'backups',
                        'url' => '/backups',
                        'permission' => ['backup.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineGlobe',
                        'name' => 'network',
                        'url' => '/network',
                        'permission' => ['network.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                ],
            ],
            'configuration' => [
                'name' => 'configuration',
                'permission' => [],
                'nests' => [],
                'eggs' => [],
                'active' => true,
                'links' => [
                    [
                        'icon' => 'HiOutlineCalendar',
                        'name' => 'schedules',
                        'url' => '/schedules',
                        'permission' => ['schedule.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineUsers',
                        'name' => 'users',
                        'url' => '/users',
                        'permission' => ['user.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                    [
                        'icon' => 'HiOutlineAdjustments',
                        'name' => 'startup',
                        'url' => '/startup',
                        'permission' => ['startup.*'],
                        'nests' => [],
                        'eggs' => [],
                        'active' => true,
                    ],
                ],
            ],
        ];
    }

    private function responseData(): array
    {
        $links = json_decode(
            $this->settings->get('settings::arix:links', json_encode($this->defaultLinks())),
            true,
        ) ?? $this->defaultLinks();

        return [
            'links' => $links,
        ];
    }

    public function index(): \Illuminate\Http\JsonResponse
    {
        return response()->json($this->responseData());
    }

    public function store(ArixLinkRequest $request)
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

            $this->settings->set('settings::arix:links', json_encode($payload['arix:links']));

            $this->alert->success('Theme settings have been updated successfully.')->flash();
        }

        return response()->json($this->responseData());
    }
    
}