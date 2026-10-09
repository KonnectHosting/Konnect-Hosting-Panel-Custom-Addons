<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Pterodactyl\Models\ActivityLog;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Transformers\Api\Client\ActivityLogTransformer;

class SessionHistoryController extends ClientApiController
{
    /**
     * Returns a paginated list of successful login events for the authenticated
     * user, sourced from the activity log with event type "auth:success".
     */
    public function __invoke(ClientApiRequest $request): array
    {
        $sessions = $request->user()
            ->activity()
            ->where('event', 'auth:success')
            ->orderByDesc('timestamp')
            ->paginate(min($request->query('per_page', 25), 100))
            ->appends($request->query());

        return $this->fractal->collection($sessions)
            ->transformWith($this->getTransformer(ActivityLogTransformer::class))
            ->toArray();
    }
}
