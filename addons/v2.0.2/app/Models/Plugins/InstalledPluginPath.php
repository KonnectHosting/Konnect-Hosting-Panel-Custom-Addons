<?php

namespace Pterodactyl\Models\Plugins;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InstalledPluginPath extends Model
{
    public $timestamps = false;

    protected $table = 'plugins_addon_installed_plugin_paths';

    protected $fillable = [
        'installed_plugin_id',
        'path',
    ];

    public function plugin(): BelongsTo
    {
        return $this->belongsTo(InstalledPlugins::class, 'installed_plugin_id');
    }
}
