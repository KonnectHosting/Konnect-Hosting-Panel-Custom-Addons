<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\Permission;
use Pterodactyl\Http\ViewComposers\AddonsConfiguration;
use Pterodactyl\Services\Servers\EggChangerService;
use Pterodactyl\Services\Servers\ReinstallServerService;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Pterodactyl\Http\Requests\Api\Client\Servers\EggChanger\EggChangerRequest;

class EggChangerController extends ClientApiController
{
    public function __construct(
        private AddonsConfiguration $addonsConfiguration,
        private EggChangerService $eggChangerService,
        private ReinstallServerService $reinstallServerService,
    ) {
        parent::__construct();
    }

    /**
     * Returns whether the addon is available for this server and, if so, the
     * eggs it is permitted to switch to along with the effective settings the
     * client needs to render its options (e.g. whether it may choose not to
     * update the startup command).
     */
    public function index(EggChangerRequest $request, Server $server): array
    {
        $addon = $this->addonsConfiguration->getAddon('eggChanger');

        $allowedEggIds = $this->resolveAllowedEggIds($server, $addon);

        $eggs = Egg::query()
            ->whereIn('id', $allowedEggIds)
            ->orderBy('name')
            ->get(['id', 'nest_id', 'name']);

        return [
            'object' => 'egg_changer',
            'attributes' => [
                'can_choose_startup_update' => !$addon['forceStartup'],
                'can_reinstall' => $request->user()->can(Permission::ACTION_SETTINGS_REINSTALL, $server),
                'eggs' => $eggs->map(fn (Egg $egg) => [
                    'id' => $egg->id,
                    'nest_id' => $egg->nest_id,
                    'name' => $egg->name,
                ])->values(),
            ],
        ];
    }

    /**
     * Switches the server over to a different egg.
     *
     * @throws \Throwable
     */
    public function update(EggChangerRequest $request, Server $server): JsonResponse
    {
        $server->validateCurrentState();

        $addon = $this->addonsConfiguration->getAddon('eggChanger');

        $targetEggId = (int) $request->input('egg_id');
        $allowedEggIds = $this->resolveAllowedEggIds($server, $addon);

        if ($targetEggId === $server->egg_id || !in_array($targetEggId, $allowedEggIds, true)) {
            throw new BadRequestHttpException('The selected egg is not available for this server.');
        }

        /** @var Egg $targetEgg */
        $targetEgg = Egg::query()->findOrFail($targetEggId);

        $updateStartup = $addon['forceStartup'] || $request->boolean('update_startup');

        $wantsReinstall = $request->boolean('reinstall');
        if ($wantsReinstall && !$request->user()->can(Permission::ACTION_SETTINGS_REINSTALL, $server)) {
            throw new AccessDeniedHttpException('You do not have permission to reinstall this server.');
        }

        $originalEggId = $server->egg_id;

        $server = $this->eggChangerService->handle($server, $targetEgg, $updateStartup);

        Activity::event('server:egg.change')
            ->subject($server)
            ->property(['old' => $originalEggId, 'new' => $targetEgg->id, 'startup_updated' => $updateStartup])
            ->log();

        if ($wantsReinstall) {
            $this->reinstallServerService->handle($server);

            Activity::event('server:reinstall')->log();
        }

        return new JsonResponse([
            'object' => 'server',
            'attributes' => [
                'egg_id' => $server->egg_id,
                'nest_id' => $server->nest_id,
                'reinstalling' => $wantsReinstall,
            ],
        ]);
    }

    /**
     * Resolves the set of egg IDs this server is permitted to switch to given
     * the addon's configuration.
     *
     * `restriction` controls the destination policy globally:
     *   - 'custom': the `nests` list is ignored entirely for both access and
     *     destinations. The server is only eligible if its current egg is
     *     explicitly listed in `eggs`, and it may only switch to destinations
     *     whitelisted for that egg in `eggMap` — which are themselves
     *     required to also be present in `eggs`.
     *   - 'none' / 'nestBased': the server is eligible if its current egg is
     *     in `eggs` OR its current nest is in `nests`. Destinations are any
     *     egg in the system ('none') or any egg in the same nest ('nestBased').
     */
    private function resolveAllowedEggIds(Server $server, array $addon): array
    {
        if (!$addon['enabled']) {
            return [];
        }

        $currentEgg = $server->egg;
        if (is_null($currentEgg)) {
            return [];
        }

        if ($addon['restriction'] === 'custom') {
            if (!in_array($server->egg_id, $addon['eggs'])) {
                return [];
            }

            $mapped = array_map('intval', (array) ($addon['eggMap'][$server->egg_id] ?? []));
            $allowed = array_diff(array_intersect($mapped, $addon['eggs']), [$server->egg_id]);

            if (empty($allowed)) {
                return [];
            }

            return Egg::query()->whereIn('id', $allowed)->pluck('id')->values()->all();
        }

        $eligible = in_array($server->egg_id, $addon['eggs']) || in_array($currentEgg->nest_id, $addon['nests']);
        if (!$eligible) {
            return [];
        }

        $query = Egg::query();
        if ($addon['restriction'] === 'nestBased') {
            $query->where('nest_id', $currentEgg->nest_id);
        }

        return $query->pluck('id')->reject(fn ($id) => (int) $id === $server->egg_id)->values()->all();
    }
}
