<?php

declare(strict_types=1);

namespace Konnect\AddonManager\Laravel;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\ServiceProvider;
use Konnect\AddonManager\Lifecycle\Manager;

final class AddonManagerServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(HostAdapter::class, fn ($app) => new HostAdapter($app));
        $this->app->singleton(Manager::class, fn ($app) => $app->make(HostAdapter::class)->manager());
        $this->app->singleton(ExtensionRegistry::class, fn ($app) => new ExtensionRegistry($app, $app->make(HostAdapter::class)));
    }

    public function boot(): void
    {
        $root = dirname(__DIR__, 2);
        $this->loadViewsFrom($root . '/resources/views', 'konnect-addons');
        $this->loadRoutesFrom($root . '/routes/admin.php');
        $extensions = $this->app->make(ExtensionRegistry::class);
        $extensions->registerRoutes();
        $extensions->registerEvents();
        $this->app->afterResolving(Schedule::class, static fn (Schedule $schedule) => $extensions->registerSchedules($schedule));
        $this->app['view']->composer('konnect-addons::navigation', static function ($view) use ($extensions): void {
            $view->with('konnectAddonMenus', $extensions->menus());
        });
    }
}
