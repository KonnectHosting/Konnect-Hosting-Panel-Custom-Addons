<?php

namespace Pterodactyl\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServerOrder extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'server_orders';

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'user_id',
        'server_ordered',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'server_ordered' => 'array',
    ];

    /**
     * Get the user that owns this server order.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}