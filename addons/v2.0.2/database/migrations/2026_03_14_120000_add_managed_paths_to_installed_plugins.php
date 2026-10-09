<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('plugins_addon_installed_plugins', function (Blueprint $table) {
            $table->string('install_directory')->nullable()->after('file_name');
        });

        Schema::create('plugins_addon_installed_plugin_paths', function (Blueprint $table) {
            $table->id();
            $table->foreignId('installed_plugin_id')
                ->constrained('plugins_addon_installed_plugins')
                ->cascadeOnDelete();
            $table->string('path');

            $table->unique(['installed_plugin_id', 'path'], 'plugins_addon_installed_plugin_paths_unique');
        });

        $plugins = DB::table('plugins_addon_installed_plugins')
            ->select(['id', 'file_name'])
            ->get();

        foreach ($plugins as $plugin) {
            if (!is_string($plugin->file_name) || $plugin->file_name === '') {
                continue;
            }

            DB::table('plugins_addon_installed_plugin_paths')->insert([
                'installed_plugin_id' => $plugin->id,
                'path' => $plugin->file_name,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('plugins_addon_installed_plugin_paths');

        Schema::table('plugins_addon_installed_plugins', function (Blueprint $table) {
            $table->dropColumn('install_directory');
        });
    }
};
