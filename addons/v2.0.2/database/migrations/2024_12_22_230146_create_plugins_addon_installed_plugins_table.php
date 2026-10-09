<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up(): void {
        Schema::create('plugins_addon_installed_plugins', function (Blueprint $table) {
            $table->id();
            $table->string('plugin_service');
            $table->string('plugin_version');
            $table->string('plugin_service_id');
            $table->integer('server_id');
            $table->string('plugin_name');
            $table->string('plugin_icon');
            $table->string('file_name');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down(): void {
        Schema::dropIfExists('plugins_addon_installed_plugins');
    }
};