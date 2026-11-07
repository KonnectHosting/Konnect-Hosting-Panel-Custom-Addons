<?php
declare(strict_types=1);

namespace Pterodactyl\Addons\GmodToolkit;

use Illuminate\Http\Request;
use Pterodactyl\Models\Server;
use RuntimeException;

final class ScannerController
{
    public function __construct(private Access $access, private BackdoorScanner $scanner) {}

    private function reply(callable $callback): mixed
    {
        try { return response()->json($callback())->header('Cache-Control', 'private, no-store'); }
        catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $error) { throw $error; }
        catch (RuntimeException $error) { return response()->json(['message' => $error->getMessage()], 422)->header('Cache-Control', 'private, no-store'); }
    }

    public function status(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        return $this->reply(fn () => $this->scanner->info($server));
    }

    public function start(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        $data = $request->validate(['archives' => 'sometimes|boolean', 'verify' => 'sometimes|boolean']);
        return $this->reply(fn () => $this->scanner->start($server, $request->user()->id, (bool) ($data['archives'] ?? false), (bool) ($data['verify'] ?? false)));
    }

    public function approve(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server, true);
        $data = $request->validate(['scan' => 'required|string|regex:/^[a-f0-9]{64}$/', 'file' => 'required|string|max:512', 'fingerprint' => 'required|string|regex:/^[a-f0-9]{64}$/']);
        return $this->reply(fn () => $this->scanner->approve($server, $request->user()->id, $data['scan'], $data['file'], $data['fingerprint']));
    }

    public function cancelStart(Request $request, Server $server): mixed
    {
        abort_unless($request->user(), 403);
        return $this->reply(fn () => app(StartGuard::class)->cancelRequest($server, $request->user()));
    }

    public function cancel(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        return $this->reply(fn () => $this->scanner->cancel($server, $request->user()));
    }
}
