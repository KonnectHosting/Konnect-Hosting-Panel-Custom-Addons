<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServerFolder extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'server_folders';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'name',
        'color',
        'icon',
        'parent_id',
        'servers',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'servers' => 'array',
    ];

    /**
     * Get the user that owns this server folder.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}