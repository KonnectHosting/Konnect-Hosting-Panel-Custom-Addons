<?php

namespace Pterodactyl\Http\Controllers\Api\Client;

use Pterodactyl\Models\ActivityLog;
use Spatie\QueryBuilder\QueryBuilder;
use Spatie\QueryBuilder\AllowedFilter;
use Pterodactyl\Http\Requests\Api\Client\ClientApiRequest;
use Pterodactyl\Transformers\Api\Client\ActivityLogTransformer;
use Carbon\Carbon;
use Pterodactyl\Models\User;

class ActivityLogController extends ClientApiController
{
    /**
     * Returns a paginated set of the user's activity logs.
     */
    public function __invoke(ClientApiRequest $request): array
    {
        $activity = QueryBuilder::for($request->user()->activity())
            ->with('actor')
            ->allowedFilters([
                AllowedFilter::partial('event'),
                AllowedFilter::partial('ip'),
                AllowedFilter::callback('user', function ($query, $value) {
                    $user = User::where('uuid', $value)->first();
                    if ($user) {
                        $query->where('actor_id', $user->id);
                    }
                }),
                AllowedFilter::callback('timestamp_from', function ($query, $value) {
                    $query->where('timestamp', '>=', Carbon::parse($value));
                }),
                AllowedFilter::callback('timestamp_to', function ($query, $value) {
                    $query->where('timestamp', '<=', Carbon::parse($value));
                }),
            ])
            ->allowedSorts(['timestamp'])
            ->whereNotIn('activity_logs.event', ActivityLog::DISABLED_EVENTS)
            ->paginate(min($request->query('per_page', 25), 100))
            ->appends($request->query());

        return $this->fractal->collection($activity)
            ->transformWith($this->getTransformer(ActivityLogTransformer::class))
            ->toArray();
    }
}
