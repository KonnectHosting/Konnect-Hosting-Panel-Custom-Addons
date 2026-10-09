<?php

namespace Pterodactyl\Http\Controllers\Admin\Nests;

use Pterodactyl\Models\Egg;
use Illuminate\Http\RedirectResponse;
use Prologue\Alerts\AlertsMessageBag;
use Pterodactyl\Models\EggStartupCommand;
use Pterodactyl\Http\Controllers\Controller;
use Pterodactyl\Http\Requests\Admin\Egg\EggStartupCommandFormRequest;

class EggStartupCommandController extends Controller
{
    public function __construct(protected AlertsMessageBag $alert)
    {
    }

    /**
     * Handle a request to create a new alternate startup command for an Egg.
     */
    public function store(EggStartupCommandFormRequest $request, Egg $egg): RedirectResponse
    {
        $egg->startupCommands()->create($request->validated());
        $this->alert->success('The startup command was created successfully.')->flash();

        return redirect()->route('admin.nests.egg.view', $egg->id);
    }

    /**
     * Handle a request to delete an alternate startup command from an Egg.
     */
    public function destroy(Egg $egg, EggStartupCommand $command): RedirectResponse
    {
        abort_unless($command->egg_id === $egg->id, 404);

        $command->delete();
        $this->alert->success('The startup command was deleted successfully.')->flash();

        return redirect()->route('admin.nests.egg.view', $egg->id);
    }
}
