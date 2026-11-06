<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use Illuminate\Http\Request;

final class AdminController
{
    public function __construct(private State $state) {}

    public function save(Request $request): mixed
    {
        $data = $request->validate(['automatic' => 'sometimes|boolean', 'eggs' => 'sometimes|array|max:100', 'eggs.*' => 'required|integer|exists:eggs,id']);
        $this->state->locked('settings', function () use ($data) {
            $settings = $this->state->read('settings');
            $settings['eggs'] = array_values(array_unique(array_map('intval', $data['eggs'] ?? [])));
            if ($data['automatic'] ?? false) { unset($settings['eggs']); }
            $this->state->write('settings', $settings);
        });
        return redirect('/admin/addon-manager/extensions/gmod.toolkit/settings')->with('status', 'GMod eggs updated.');
    }

}
