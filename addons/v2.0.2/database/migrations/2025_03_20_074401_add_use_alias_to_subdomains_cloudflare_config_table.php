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
        Schema::table('subdomains_cloudflare_config', function (Blueprint $table) {
            $table->boolean('use_alias')->default(false)->after('proxy_records');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('subdomains_cloudflare_config', function (Blueprint $table) {
            //
        });
    }
};
