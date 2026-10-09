<?php

namespace Pterodactyl\Http\Controllers\Admin\SubdomainsAddon;

use Illuminate\Contracts\View\Factory as ViewFactory;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\Subdomains\SubdomainsUserSubdomain;
use Pterodactyl\Repositories\Eloquent\DatabaseHostRepository;
use Pterodactyl\Repositories\Eloquent\LocationRepository;
use Pterodactyl\Repositories\Eloquent\MountRepository;
use Pterodactyl\Repositories\Eloquent\NestRepository;
use Pterodactyl\Repositories\Eloquent\NodeRepository;
use Pterodactyl\Repositories\Eloquent\ServerRepository;
use Pterodactyl\Services\Servers\EnvironmentService;
use Pterodactyl\Traits\Controllers\JavascriptInjection;

class SubdomainsAddonConfigController extends Controller {
    use JavascriptInjection;

    public function __construct(
        protected AlertsMessageBag $alert,
        private DatabaseHostRepository $databaseHostRepository,
        private LocationRepository $locationRepository,
        private MountRepository $mountRepository,
        private NestRepository $nestRepository,
        private NodeRepository $nodeRepository,
        private ServerRepository $repository,
        private EnvironmentService $environmentService,
        private ViewFactory $view
    ) {
    }

    public function subdomains(Request $request, Server $server): View
    {
        $subdomainsForServer = SubdomainsUserSubdomain::where('server_id', $server->id)->get();
        return $this->view->make('admin.subdomainsAddon.serverSubdomains', [
            'server' => $server,
            'userSubdomains' => $subdomainsForServer,
        ]);
    }

    public function UpdateConfig(Request $request, Server $server) {
        Server::where('id', $server->id)->update([
            'subdomain_limit' => $request->input('subdomain_limit')
        ]);

        $this->alert->success('Config updated')->flash();

        return redirect()->route('admin.servers.view.subdomains', $server->id);
    }
}