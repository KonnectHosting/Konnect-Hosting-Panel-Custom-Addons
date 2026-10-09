<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $server_id
 * @property string $command
 * @property \Carbon\CarbonImmutable $executed_at
 * @property Server $server
 */
class CommandHistory extends Model
{
    public const RESOURCE_NAME = 'command_history';

    protected $table = 'command_history';

    public $timestamps = false;

    protected bool $immutableDates = true;

    protected $casts = [
        'id' => 'int',
        'server_id' => 'int',
        'executed_at' => 'datetime',
    ];

    protected $fillable = ['server_id', 'command', 'executed_at'];

    public static array $validationRules = [
        'server_id' => 'required|numeric|exists:servers,id',
        'command' => 'required|string|max:1000',
        'executed_at' => 'required|date',
    ];

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<\Pterodactyl\Models\Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
