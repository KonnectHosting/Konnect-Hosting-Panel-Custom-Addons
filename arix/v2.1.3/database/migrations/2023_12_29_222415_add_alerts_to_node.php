<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('nodes', function (Blueprint $table) {
            $table->string('alert')->nullable()->after('name');
            $table->string('daemon_text')->default('[Pterodactyl Daemon]:')->after('alert');
            $table->string('container_text')->default('container@pterodactyl~')->after('daemon_text');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('nodes', function (Blueprint $table) {
            $table->dropColumn('alert');
            $table->dropColumn('daemon_text');
            $table->dropColumn('container_text');
        });
    }
};
