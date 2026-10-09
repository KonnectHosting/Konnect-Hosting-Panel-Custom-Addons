<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Trashbin extends Model
{
    public const RESOURCE_NAME = 'trashbin_item';

    protected $table = 'trashbin';

    protected $fillable = [
        'server_id',
        'trash_root',
        'trash_name',
        'original_root',
        'original_name',
        'is_directory',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'is_directory' => 'boolean',
        self::CREATED_AT => 'datetime',
        self::UPDATED_AT => 'datetime',
    ];

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsTo<\Pterodactyl\Models\Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
