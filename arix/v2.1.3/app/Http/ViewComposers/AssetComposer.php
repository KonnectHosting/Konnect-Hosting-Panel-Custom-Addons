<?php

namespace Pterodactyl\Http\ViewComposers;

use Illuminate\View\View;
use Pterodactyl\Services\Helpers\AssetHashService;
use Pterodactyl\Http\ViewComposers\ArixConfiguration;

class AssetComposer
{
    public function __construct(private AssetHashService $assetHashService, private ArixConfiguration $arixConfiguration)
    {
    }

    public function compose(View $view): void
    {
        $view->with('asset', $this->assetHashService);
        $view->with('siteConfiguration', [
            'name' => config('app.name') ?? 'Pterodactyl',
            'arix' => $this->arixConfiguration->getConfiguration(),
            'locale' => config('app.locale') ?? 'en',
            'recaptcha' => [
                'enabled' => config('recaptcha.enabled', false),
                'method' => config('recaptcha.method', 'recaptcha'),
                'siteKey' => config('recaptcha.website_key') ?? '',
            ],
            'turnstile' => [
                'siteKey' => config('turnstile.site_key') ?? '',
            ],
        ]);
    }
}
