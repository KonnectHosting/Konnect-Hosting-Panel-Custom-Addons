<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Pterodactyl\Models\Server;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\EggStartupCommand;
use Pterodactyl\Services\Servers\StartupCommandService;
use Pterodactyl\Http\ViewComposers\AddonsConfiguration;
use Pterodactyl\Repositories\Eloquent\ServerVariableRepository;
use Pterodactyl\Transformers\Api\Client\EggVariableTransformer;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Pterodactyl\Http\Requests\Api\Client\Servers\Startup\GetStartupRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Startup\StartupCommandRequest;
use Pterodactyl\Http\Requests\Api\Client\Servers\Startup\UpdateStartupVariableRequest;

class StartupController extends ClientApiController
{
    /**
     * StartupController constructor.
     */
    public function __construct(
        private StartupCommandService $startupCommandService,
        private ServerVariableRepository $repository,
        private AddonsConfiguration $addonsConfiguration,
    ) {
        parent::__construct();
    }

    /**
     * Returns the startup information for the server including all the variables.
     */
    public function index(GetStartupRequest $request, Server $server): array
    {
        $startup = $this->startupCommandService->handle($server);

        return $this->fractal->collection(
            $server->variables()->where('user_viewable', true)->get()
        )
            ->transformWith($this->getTransformer(EggVariableTransformer::class))
            ->addMeta([
                'startup_command' => $startup,
                'docker_images' => $server->egg->docker_images,
                'raw_startup_command' => $server->startup,
            ])
            ->toArray();
    }

    /**
     * Updates a single variable for a server.
     *
     * @throws \Illuminate\Validation\ValidationException
     * @throws \Pterodactyl\Exceptions\Model\DataValidationException
     * @throws \Pterodactyl\Exceptions\Repository\RecordNotFoundException
     */
    public function update(UpdateStartupVariableRequest $request, Server $server): array
    {
        $variable = $server->variables()->where('env_variable', $request->input('key'))->first();

        if (is_null($variable) || !$variable->user_viewable) {
            throw new BadRequestHttpException('The environment variable you are trying to edit does not exist.');
        } elseif (!$variable->user_editable) {
            throw new BadRequestHttpException('The environment variable you are trying to edit is read-only.');
        }

        $original = $variable->server_value;

        // Revalidate the variable value using the egg variable specific validation rules for it.
        $this->validate($request, ['value' => $variable->rules]);

        $this->repository->updateOrCreate([
            'server_id' => $server->id,
            'variable_id' => $variable->id,
        ], [
            'variable_value' => $request->input('value') ?? '',
        ]);

        $variable = $variable->refresh();
        $variable->server_value = $request->input('value');

        $startup = $this->startupCommandService->handle($server);

        if ($original !== $request->input('value')) {
            Activity::event('server:startup.edit')
                ->subject($variable)
                ->property([
                    'variable' => $variable->env_variable,
                    'old' => $original,
                    'new' => $request->input('value') ?? '',
                ])
                ->log();
        }

        return $this->fractal->item($variable)
            ->transformWith($this->getTransformer(EggVariableTransformer::class))
            ->addMeta([
                'startup_command' => $startup,
                'raw_startup_command' => $server->startup,
            ])
            ->toArray();
    }

    /**
     * Returns every startup command available to the server's egg, including
     * the egg's default startup command.
     */
    public function commands(StartupCommandRequest $request, Server $server): array
    {
        $this->ensureAddonEnabled($server);

        $commands = $server->egg->startupCommands->map(fn (EggStartupCommand $command) => [
            'id' => $command->id,
            'name' => $command->name,
            'command' => $command->command,
            'is_default' => false,
        ]);

        return [
            'data' => $commands->prepend([
                'id' => 0,
                'name' => 'Default',
                'command' => $server->egg->startup,
                'is_default' => true,
            ])->values(),
        ];
    }

    /**
     * Switches the server's active startup command to either the egg's default
     * (id: 0) or one of the egg's alternate startup commands. The command is
     * always looked up by ID and scoped to the server's own egg, so a user can
     * never supply an arbitrary startup string or borrow a command from a
     * different egg.
     */
    public function switchCommand(StartupCommandRequest $request, Server $server): array
    {
        $this->ensureAddonEnabled($server);

        $id = (int) $request->input('id');

        if ($id === 0) {
            $command = $server->egg->startup;
        } else {
            $command = EggStartupCommand::query()
                ->where('id', $id)
                ->where('egg_id', $server->egg_id)
                ->first();

            if (is_null($command)) {
                throw new BadRequestHttpException('The startup command you are trying to switch to does not exist for this egg.');
            }

            $command = $command->command;
        }

        $original = $server->startup;
        $server->update(['startup' => $command]);

        if ($original !== $command) {
            Activity::event('server:startup.command-change')
                ->subject($server)
                ->property(['old' => $original, 'new' => $command])
                ->log();
        }

        return [
            'startup_command' => $this->startupCommandService->handle($server),
            'raw_startup_command' => $server->startup,
        ];
    }

    /**
     * Ensures the startupChanger addon is enabled for this server's egg/nest
     * before allowing the startup command to be read or switched. This mirrors
     * the client-side gating in resources/scripts/plugins/addonAvailable.ts,
     * but enforced server-side since the client-side check alone can be bypassed.
     */
    private function ensureAddonEnabled(Server $server): void
    {
        $addon = $this->addonsConfiguration->getAddon('startupChanger');

        $allowed = $addon['enabled']
            && (empty($addon['nests']) || in_array($server->egg->nest_id, $addon['nests']))
            && (empty($addon['eggs']) || in_array($server->egg_id, $addon['eggs']));

        if (!$allowed) {
            throw new AccessDeniedHttpException('The startup changer addon is not enabled for this server.');
        }
    }
}
