<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Pterodactyl\Http\Requests\Api\Client\UpdateServerFolderRequest;
use Pterodactyl\Models\Server;
use Pterodactyl\Models\ServerFolder;
use Pterodactyl\Models\ServerOrder;
use Pterodactyl\Models\Permission;
use Pterodactyl\Transformers\Api\Client\ServerFolderTransformer;
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedFilter;
use Pterodactyl\Models\Filters\MultiFieldServerFilter;
use Pterodactyl\Transformers\Api\Client\ServerTransformer;
use Pterodactyl\Transformers\Api\Client\ServerOrderTransformer;
use Pterodactyl\Http\Requests\Api\Client\GetServersRequest;
use Pterodactyl\Http\Requests\Api\Client\UpdateServerOrderRequest;

class ClientController extends ClientApiController
{
    /**
     * ClientController constructor.
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Return all the servers available to the client making the API
     * request, including servers the user has access to as a subuser.
     */
    public function index(GetServersRequest $request): array
    {
        $user = $request->user();
        $transformer = $this->getTransformer(ServerTransformer::class);

        // Start the query builder and ensure we eager load any requested relationships from the request.
        $builder = QueryBuilder::for(
            Server::query()->with($this->getIncludesForTransformer($transformer, ['node']))
        )->allowedFilters([
            'uuid',
            'name',
            'description',
            'external_id',
            AllowedFilter::custom('*', new MultiFieldServerFilter()),
        ]);

        $type = $request->input('type');
        // Either return all the servers the user has access to because they are an admin `?type=admin` or
        // just return all the servers the user has access to because they are the owner or a subuser of the
        // server. If ?type=admin-all is passed all servers on the system will be returned to the user, rather
        // than only servers they can see because they are an admin.
        if (in_array($type, ['admin', 'admin-all'])) {
            // If they aren't an admin but want all the admin servers don't fail the request, just
            // make it a query that will never return any results back.
            if (!$user->root_admin) {
                $builder->whereRaw('1 = 2');
            } else {
                $builder = $type === 'admin-all'
                    ? $builder
                    : $builder->whereNotIn('servers.id', $user->accessibleServers()->pluck('id')->all());
            }
        } elseif ($type === 'owner') {
            $builder = $builder->where('servers.owner_id', $user->id);
        } else {
            $builder = $builder->whereIn('servers.id', $user->accessibleServers()->pluck('id')->all());
        }

        $servers = $builder->paginate(min($request->query('per_page', 50), 100))->appends($request->query());

        return $this->fractal->transformWith($transformer)->collection($servers)->toArray();
    }

    /**
     * Returns all the subuser permissions available on the system.
     */
    public function permissions(): array
    {
        return [
            'object' => 'system_permissions',
            'attributes' => [
                'permissions' => Permission::permissions(),
            ],
        ];
    }

    /**
     * Return all server orders for the authenticated user.
     */
    public function getServerOrders(GetServersRequest $request): array
    {
        $user = $request->user();
        $transformer = $this->getTransformer(ServerOrderTransformer::class);

        $orders = ServerOrder::where('user_id', $user->id)
            ->with($this->getIncludesForTransformer($transformer))
            ->get();

        return $this->fractal->transformWith($transformer)->collection($orders)->toArray();
    }

    /**
     * Update a specific server order for the authenticated user.
     */
    public function updateServerOrder(UpdateServerOrderRequest $request): array
    {
        $user = $request->user();

        $serverOrder = ServerOrder::firstOrCreate(
            ['user_id' => $user->id],
            ['server_ordered' => []]
        );

        if ($request->has('server_ordered')) {
            $serverOrder->server_ordered = $request->input('server_ordered', []);
            $serverOrder->save();
        }

        $transformer = $this->getTransformer(ServerOrderTransformer::class);

        return $this->fractal->transformWith($transformer)->item($serverOrder)->toArray();
    }

    /**
     * Get server folders for the authenticated user.
     */
    public function getServerFolders(GetServersRequest $request): array
    {
        $user = $request->user();
        $transformer = $this->getTransformer(ServerFolderTransformer::class);

        $folders = ServerFolder::where('user_id', $user->id)
            ->with($this->getIncludesForTransformer($transformer))
            ->get();

        return $this->fractal->transformWith($transformer)->collection($folders)->toArray();
    }

    /**
     * Create a new server folder for the authenticated user.
     */
    public function createServerFolder(UpdateServerFolderRequest $request): array
    {
        $user = $request->user();
        
        $folderCount = ServerFolder::where('user_id', $user->id)->count();
        if ($folderCount >= 10) {
            abort(400, 'You have reached the maximum limit of 10 folders.');
        }
        
        $transformer = $this->getTransformer(ServerFolderTransformer::class);

        $folder = ServerFolder::create(array_merge(
            $request->only(['name', 'color', 'icon', 'parent_id', 'servers']),
            ['user_id' => $user->id]
        ));

        return $this->fractal->transformWith($transformer)->item($folder)->toArray();
    }

    /**
     * Update a server folder for the authenticated user.
     */
    public function updateServerFolder(UpdateServerFolderRequest $request, int $id): array
    {
        $user = $request->user();
        $transformer = $this->getTransformer(ServerFolderTransformer::class);

        $folder = ServerFolder::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $folder->update($request->only(['name', 'color', 'icon', 'parent_id', 'servers']));

        return $this->fractal->transformWith($transformer)->item($folder)->toArray();
    }

    /**
     * Delete a server folder for the authenticated user.
     */
    public function deleteServerFolder(GetServersRequest $request, int $id): void
    {
        $user = $request->user();

        ServerFolder::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail()
            ->delete();
    }

    /**
     * Add a server to a folder.
     */
    public function addServerToFolder(GetServersRequest $request, int $folderId, string $serverUuid): array
    {
        $user = $request->user();
        $transformer = $this->getTransformer(ServerFolderTransformer::class);

        $folder = ServerFolder::where('id', $folderId)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $serverQuery = Server::where('uuid', $serverUuid);

        if (!$user->root_admin) {
            $serverQuery->whereIn('id', $user->accessibleServers()->pluck('id'));
        }

        $server = $serverQuery->firstOrFail();

        $servers = $folder->servers ?? [];
        if (!in_array($server->uuid, $servers)) {
            $servers[] = $server->uuid;
            $folder->servers = $servers;
            $folder->save();
        }

        return $this->fractal->transformWith($transformer)->item($folder)->toArray();
    }

    /**
     * Remove a server from a folder.
     */
    public function removeServerFromFolder(GetServersRequest $request, int $folderId, string $serverUuid): array
    {
        $user = $request->user();
        $transformer = $this->getTransformer(ServerFolderTransformer::class);

        $folder = ServerFolder::where('id', $folderId)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $server = Server::where('uuid', $serverUuid)->firstOrFail();

        // Remove server from the array
        $servers = $folder->servers ?? [];
        $servers = array_values(array_filter($servers, fn($id) => $id != $server->uuid));
        $folder->servers = $servers;
        $folder->save();

        return $this->fractal->transformWith($transformer)->item($folder)->toArray();
    }
}