<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $server_id
 * @property string $name
 * @property array|null $permissions
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property Server $server
 */
class SubuserPreset extends Model
{
    public const RESOURCE_NAME = 'subuser_preset';

    protected $table = 'subuser_presets';

    protected $guarded = ['id', 'created_at', 'updated_at'];

    protected $casts = [
        'server_id' => 'int',
        'permissions' => 'array',
    ];

    public static array $validationRules = [
        'server_id' => 'required|numeric|exists:servers,id',
        'name' => 'required|string|between:1,191',
        'permissions' => 'nullable|array',
        'permissions.*' => 'string',
    ];

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<\Pterodactyl\Models\Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
