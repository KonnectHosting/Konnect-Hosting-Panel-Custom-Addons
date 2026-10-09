<?php

namespace Pterodactyl\Http\Controllers\Api\Client\Servers;

use Illuminate\Http\Response;
use Pterodactyl\Models\Server;
use Illuminate\Http\JsonResponse;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Contracts\Repository\SettingsRepositoryInterface;
use Pterodactyl\Services\Servers\Files\TrashbinService;
use Pterodactyl\Transformers\Api\Client\TrashbinItemTransformer;
use Pterodactyl\Http\Controllers\Api\Client\ClientApiController;
use Pterodactyl\Http\Requests\Api\Client\Servers\Files\TrashbinRequest;
use Symfony\Component\HttpKernel\Exception\BadRequestHttpException;

class TrashbinController extends ClientApiController
{
    public function __construct(private TrashbinService $trashbinService)
    {
        parent::__construct();
    }

    public function index(TrashbinRequest $request, Server $server): array
    {
        $contents = $this->trashbinService->list($server);

        return $this->fractal->collection($contents)
            ->transformWith($this->getTransformer(TrashbinItemTransformer::class))
            ->toArray();
    }

    public function move(TrashbinRequest $request, Server $server): JsonResponse
    {
        $enabled = filter_var(
            app(SettingsRepositoryInterface::class)->get('settings::arix:advanced:trashbin', true),
            FILTER_VALIDATE_BOOLEAN
        );

        if (!$enabled) {
            throw new BadRequestHttpException('Trashbin is disabled.');
        }

        $this->trashbinService->move(
            $server,
            $request->input('root'),
            $request->input('files', [])
        );

        Activity::event('server:trashbin.move')
            ->property('directory', $request->input('root'))
            ->property('files', $request->input('files'))
            ->log();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    public function restore(TrashbinRequest $request, Server $server): JsonResponse
    {
        $this->trashbinService->restore($server, $request->input('files', []));

        Activity::event('server:trashbin.restore')
            ->property('files', $request->input('files'))
            ->log();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }

    public function delete(TrashbinRequest $request, Server $server): JsonResponse
    {
        $this->trashbinService->delete($server, $request->input('files', []));

        Activity::event('server:trashbin.delete')
            ->property('files', $request->input('files'))
            ->log();

        return new JsonResponse([], Response::HTTP_NO_CONTENT);
    }
}
