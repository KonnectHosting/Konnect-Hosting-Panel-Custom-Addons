<?php

namespace Pterodactyl\Models\Plugins;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Pterodactyl\Models\Server;

class InstalledPlugins extends Model
{
    use HasFactory;

    protected $appends = ['managed_paths'];

    protected $hidden = ['managedFiles'];

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'plugins_addon_installed_plugins';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'plugin_service',
        'plugin_version',
        'plugin_service_id',
        'server_id',
        'plugin_name',
        'plugin_icon',
        'file_name',
        'install_directory',
        'installable_type',
    ];

    public function managedFiles(): HasMany
    {
        return $this->hasMany(InstalledPluginPath::class, 'installed_plugin_id');
    }

    public function scopeForServer(Builder $query, Server|int $server): Builder
    {
        return $query->where('server_id', $server instanceof Server ? $server->id : $server);
    }

    public function scopeForInstallContext(
        Builder $query,
        string $directory,
        ?string $installableType = null,
    ): Builder {
        $query->where('install_directory', $directory);

        if ($installableType === null) {
            return $query;
        }

        return $query->where('installable_type', $installableType);
    }

    public function getManagedPathsAttribute(): array
    {
        $paths = $this->relationLoaded('managedFiles')
            ? $this->managedFiles->pluck('path')->all()
            : InstalledPluginPath::query()
                ->where('installed_plugin_id', $this->id)
                ->pluck('path')
                ->all();

        $fileName = (string) $this->file_name;
        if (count($paths) === 0 && $fileName !== '') {
            return [$fileName];
        }

        sort($paths);

        return array_values(array_unique($paths));
    }
}
