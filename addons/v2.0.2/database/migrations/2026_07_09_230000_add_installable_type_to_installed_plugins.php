<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class () extends Migration {
    public function up(): void
    {
        Schema::table('plugins_addon_installed_plugins', function (Blueprint $table) {
            $table->string('installable_type')->nullable()->after('install_directory');
            $table->index(['server_id', 'installable_type'], 'plugins_addon_installed_type_index');
        });

        DB::table('plugins_addon_installed_plugins')
            ->whereNull('install_directory')
            ->update(['install_directory' => '/plugins']);

        DB::table('plugins_addon_installed_plugins')
            ->where('install_directory', '/plugins')
            ->update(['installable_type' => 'plugin']);
        DB::table('plugins_addon_installed_plugins')
            ->where('install_directory', '/mods')
            ->update(['installable_type' => 'mod']);
        DB::table('plugins_addon_installed_plugins')
            ->where('install_directory', '/')
            ->whereExists(function ($query) {
                $query->selectRaw('1')
                    ->from('plugins_addon_installed_plugin_paths')
                    ->whereColumn('plugins_addon_installed_plugin_paths.installed_plugin_id', 'plugins_addon_installed_plugins.id')
                    ->where('plugins_addon_installed_plugin_paths.path', 'like', 'mods/%');
            })
            ->update(['installable_type' => 'modpack']);
        DB::table('plugins_addon_installed_plugins')
            ->whereNull('installable_type')
            ->update(['installable_type' => 'world']);

        Schema::table('plugins_addon_installed_plugins', function (Blueprint $table) {
            $table->string('install_directory')->nullable(false)->change();
            $table->string('installable_type')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('plugins_addon_installed_plugins', function (Blueprint $table) {
            $table->dropIndex('plugins_addon_installed_type_index');
            $table->dropColumn('installable_type');
        });
    }
};
