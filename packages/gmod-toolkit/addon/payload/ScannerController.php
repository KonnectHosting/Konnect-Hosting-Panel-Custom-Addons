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
        return $this->reply(fn () => $this->scanner->start($server, $request->user()->id));
    }

    public function cancel(Request $request, Server $server): mixed
    {
        $this->access->check($request, $server);
        return $this->reply(fn () => $this->scanner->cancel($server));
    }
}
