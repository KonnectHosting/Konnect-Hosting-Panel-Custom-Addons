<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use Illuminate\Http\Request;
use Pterodactyl\Models\Node;

final class AdminController
{
    public function __construct(private State $state) {}

    public function save(Request $request): mixed
    {
        $data = $request->validate(['eggs' => 'sometimes|array|max:100', 'eggs.*' => 'required|integer|exists:eggs,id']);
        $this->state->locked('settings', function () use ($data) {
            $settings = $this->state->read('settings');
            $settings['eggs'] = array_values(array_unique(array_map('intval', $data['eggs'] ?? [])));
            $this->state->write('settings', $settings);
        });
        return redirect('/admin/addon-manager/extensions/gmod.toolkit/settings')->with('status', 'GMod eggs updated.');
    }

    public function provision(Request $request): mixed
    {
        $data = $request->validate(['node' => 'required|integer|exists:nodes,id', 'volume_root' => 'required|string|max:200|regex:#^/[a-zA-Z0-9_/-]+$#']);
        abort_if(str_contains($data['volume_root'], '..'), 422);
        $node = Node::findOrFail($data['node']);
        $key = $this->state->locked('settings', function () use ($node) {
            $settings = $this->state->read('settings');
            $settings['nodes'][(string) $node->id] ??= bin2hex(random_bytes(32));
            $this->state->write('settings', $settings);
            return $settings['nodes'][(string) $node->id];
        });
        return response(json_encode(['key' => $key, 'volume_root' => $data['volume_root'], 'state_root' => '/var/lib/gmod-toolkit'], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n")
            ->header('Content-Type', 'application/json')->header('Content-Disposition', 'attachment; filename="config.json"')->header('Cache-Control', 'no-store');
    }
}
