<?php

namespace Pterodactyl\Http\Controllers\Api\Client\FiveMAddon;

use Pterodactyl\Models\Server;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\EggVariable;
use Pterodactyl\Helpers\ArixAddons;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Exceptions\DisplayException;
use Pterodactyl\Services\Servers\StartupCommandService;
use Pterodactyl\Repositories\Eloquent\ServerVariableRepository;
use Pterodactyl\Services\Allocations\FindAssignableAllocationService;
use Pterodactyl\Http\Controllers\Api\Client\ClientController;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Pterodactyl\Http\Requests\Api\Client\FiveMAddon\TxAdminRequest;

class FivemController extends ClientController
{
    public function __construct(
        private FindAssignableAllocationService $assignableAllocationService,
        private StartupCommandService $startupCommandService,
        private ServerVariableRepository $variableRepository,
    ) {
        parent::__construct();
    }

    public function versions(): array {
        return ArixAddons::licensedRequestToApi('/fiveM/versions', [], false, 'GET', 24);
    }

    public function activate(TxAdminRequest $request, Server $server): array
    {
        [$enableVariable, $portVariable] = $this->resolveVariables($server);

        $port = Activity::event('server:txadmin.activate')->transaction(function ($log) use ($server, $enableVariable, $portVariable) {
            if ($enableVariable->server_value === '1' && $server->allocations()->where('port', (int) $portVariable->server_value)->exists()) {
                return (int) $portVariable->server_value;
            }

            if ($server->allocations()->count() >= $server->allocation_limit) {
                throw new DisplayException('Cannot assign an allocation for TxAdmin: this server\'s allocation limit has been reached.');
            }

            $allocation = $this->assignableAllocationService->handle($server);

            $this->writeVariable($server, $portVariable, (string) $allocation->port);
            $this->writeVariable($server, $enableVariable, '1');

            $log->subject($allocation)->property('allocation', $allocation->toString());

            return $allocation->port;
        });

        $this->startupCommandService->handle($server);

        return $this->response(true, $port);
    }

    public function deactivate(TxAdminRequest $request, Server $server): array
    {
        [$enableVariable, $portVariable] = $this->resolveVariables($server);

        Activity::event('server:txadmin.deactivate')->transaction(function ($log) use ($server, $enableVariable, $portVariable) {
            $allocation = $server->allocations()
                ->where('port', (int) $portVariable->server_value)
                ->where('id', '!=', $server->allocation_id)
                ->first();

            $this->writeVariable($server, $enableVariable, '0');
            $this->writeVariable($server, $portVariable, '');

            if ($allocation) {
                Allocation::query()->where('id', $allocation->id)->update(['notes' => null, 'server_id' => null]);
                $log->subject($allocation)->property('allocation', $allocation->toString());
            }
        });

        $this->startupCommandService->handle($server);

        return $this->response(false, null);
    }

    /**
     * @return array{0: EggVariable, 1: EggVariable}
     */
    private function resolveVariables(Server $server): array
    {
        $enableVariable = $server->variables()->where('env_variable', 'TXADMIN_ENABLE')->first();
        $portVariable = $server->variables()->where('env_variable', 'TXHOST_TXA_PORT')->first();

        if (!$enableVariable || !$portVariable) {
            throw new BadRequestHttpException('This server\'s egg does not support automatic TxAdmin setup.');
        }

        return [$enableVariable, $portVariable];
    }

    private function writeVariable(Server $server, EggVariable $variable, string $value): void
    {
        $this->variableRepository->updateOrCreate([
            'server_id' => $server->id,
            'variable_id' => $variable->id,
        ], [
            'variable_value' => $value,
        ]);
    }

    private function response(bool $enabled, ?int $port): array
    {
        return [
            'object' => 'txadmin_setup',
            'attributes' => [
                'enabled' => $enabled,
                'port' => $port,
            ],
        ];
    }
}
