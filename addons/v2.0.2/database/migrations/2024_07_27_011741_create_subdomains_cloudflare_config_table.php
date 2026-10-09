<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;

class CreateSubdomainsCloudflareConfigTable extends Migration
{
    public function up(): void
    {
        Schema::create('subdomains_cloudflare_config', function (Blueprint $table) {
            $table->id();
            $table->string('email');
            $table->string('api_key');
            $table->boolean('proxy_records');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subdomains_cloudflare_config');
    }
}