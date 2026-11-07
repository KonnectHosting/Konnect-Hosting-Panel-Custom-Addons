<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use RuntimeException;

final class ToolkitController
{
    public function __construct(private Access $access, private State $state, private WingsFiles $files, private Workshop $workshop, private Fastdl $fastdl) {}

    private function reply(callable $callback): mixed
    {
        try { return response()->json($callback())->header('Cache-Control', 'no-store'); }
        catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $error) { throw $error; }
        catch (RuntimeException $error) { return response()->json(['message' => $error->getMessage()], 422)->header('Cache-Control', 'no-store'); }
    }

    public function status(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        return $this->reply(function () use ($request, $server) {
            $fastdl = $this->fastdl->info($server, $request->user()->id);
            return ['fastdl' => $fastdl, 'backups' => array_map(static fn ($entry) => ['id' => $entry['id'], 'created' => $entry['created']], $this->state->backups($server->uuid)),
                'target' => WingsFiles::LUA];
        });
    }

    public function workshopStatus(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        return $this->reply(fn () => ['backups' => array_map(static fn ($entry) => ['id' => $entry['id'], 'created' => $entry['created']], $this->state->backups($server->uuid)),
            'target' => WingsFiles::LUA] + (new WorkshopView($this->state, $this->workshop))->status($server->uuid, $request->user()->id));
    }

    public function selection(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        $data = $request->validate(['collection' => 'present|nullable|string|max:1024']);
        return $this->reply(fn () => (new WorkshopView($this->state, $this->workshop))->save($server->uuid, $request->user()->id, $data['collection'] ?? ''));
    }

    public function fastdlStatus(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        return $this->reply(fn () => ['fastdl' => $this->fastdl->info($server, $request->user()->id)]);
    }

    public function cover(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        return response(AddonPackage::cover(), 200, ['Content-Type' => 'image/jpeg', 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, max-age=3600']);
    }

    public function buildAddon(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server, true);
        $data = $request->validate(['preview' => 'required|string|regex:/^[a-f0-9]{64}$/', 'name' => 'required|string|max:80',
            'description' => 'present|nullable|string|max:5000', 'cover' => 'sometimes|nullable|string|max:1398104']);
        return $this->reply(fn () => $this->fastdl->buildAddon($server, $request->user()->id, $data['preview'], $data));
    }

    public function downloadAddon(Request $request, Server $server, string $id): mixed
    {
        $this->access->check($request, $server, true);
        $file = $this->fastdl->addonDownload($server, $request->user()->id, $id);
        return response()->download($file['path'], $file['filename'], ['Content-Type' => 'application/zip', 'X-Content-Type-Options' => 'nosniff', 'Cache-Control' => 'private, no-store'])->setPrivate();
    }

    public function preview(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        $data = $request->validate(['collection' => 'required_without:backup|string|max:1024', 'backup' => 'required_without:collection|string|regex:/^[a-f0-9]{64}$/']);
        abort_if(isset($data['collection'], $data['backup']), 422, 'Choose a collection or a backup.');
        return $this->reply(fn () => $this->state->locked($server->uuid, function () use ($request, $server, $data) {
            $current = $this->files->read($server);
            if (isset($data['backup'])) {
                $found = null;
                foreach ($this->state->backups($server->uuid) as $entry) { if ($entry['id'] === $data['backup']) { $found = $entry; break; } }
                abort_unless($found, 404);
                $result = ['lua' => $found['lua'], 'items' => [], 'duplicates' => 0, 'collections' => 0, 'restoring' => true];
            } else { $result = $this->workshop->resolve($data['collection']); }
            $collection = isset($result['collection']) ? array_intersect_key($result, array_flip(['collection', 'title', 'bytes', 'knownSizes', 'items', 'collections', 'duplicates'])) : null;
            $id = bin2hex(random_bytes(32));
            // One pending preview per server bounds retained previews and prevents replay.
            $this->state->write('preview-' . $server->uuid, ['id' => $id, 'actor' => $request->user()->id, 'expires' => time() + 900,
                'before' => $current === null ? null : hash('sha256', $current), 'lua' => $result['lua'], 'collection' => $collection]);
            preg_match_all('/resource\.AddWorkshop\(\s*["\']([0-9]+)["\']\s*\)/', $current ?? '', $matches);
            $old = array_unique($matches[1]); $new = array_column($result['items'], 'id');
            return $result + ['preview' => $id, 'before' => $current, 'added' => array_values(array_diff($new, $old)), 'removed' => array_values(array_diff($old, $new)), 'target' => WingsFiles::LUA];
        }));
    }

    public function apply(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server, true);
        $data = $request->validate(['preview' => 'required|string|regex:/^[a-f0-9]{64}$/']);
        return $this->reply(fn () => $this->state->locked($server->uuid, function () use ($request, $server, $data) {
            $preview = $this->state->read('preview-' . $server->uuid);
            abort_unless(($preview['id'] ?? null) === $data['preview'] && ($preview['actor'] ?? null) === $request->user()->id && ($preview['expires'] ?? 0) >= time(), 409, 'Preview expired or belongs to another user.');
            $current = $this->files->read($server);
            abort_unless(($current === null ? null : hash('sha256', $current)) === $preview['before'], 409, 'Workshop Lua changed after preview. Preview again.');
            if ($current !== null) {
                $backups = $this->state->backups($server->uuid);
                array_unshift($backups, ['id' => bin2hex(random_bytes(32)), 'created' => gmdate('c'), 'lua' => $current]);
                // Bounded to the 20 most recent previous versions, private on the Panel.
                $this->state->write('backups-' . $server->uuid, ['entries' => array_slice($backups, 0, 20)]);
            }
            $this->files->write($server, $preview['lua']);
            $this->state->write('workshop-collection-' . $server->uuid, ['result' => $preview['collection'] ?? null]);
            $this->state->write('preview-' . $server->uuid, []);
            return ['message' => 'Workshop client-download Lua saved. Restart the game server when ready.'];
        }));
    }

    public function fastdl(Request $request, Server $server, string $action): mixed
    {
        abort_unless(in_array($action, ['prepare', 'preview', 'publish', 'rotate', 'revoke'], true), 404);
        $this->access->check($request, $server, $action !== 'preview');
        $data = $request->validate(['preview' => ($action === 'publish' ? 'required|' : 'sometimes|') . 'string|regex:/^[a-f0-9]{64}$/']);
        return $this->reply(fn () => match ($action) {
            'prepare' => $this->fastdl->prepare($server),
            'preview' => $this->fastdl->preview($server, $request->user()->id),
            'publish' => $this->fastdl->publish($server, $request->user()->id, $data['preview']),
            'rotate' => $this->fastdl->rotate($server, false),
            'revoke' => $this->fastdl->rotate($server, true),
        });
    }
}
