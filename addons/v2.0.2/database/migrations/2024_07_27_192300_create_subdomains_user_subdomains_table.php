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
        Schema::create('subdomains_user_subdomains', function (Blueprint $table) {
            $table->id();
            $table->string('subdomain')->unique();

            // Ensure the foreign key column type matches the primary key type of the referenced table
            $table->string('domain');
            $table->foreign('domain')->references('domain')->on('subdomains_connected_domains')->onDelete('cascade');

            $table->string('full_domain')->unique();
            $table->integer('nest_id');
            $table->string('server_id');
            $table->integer('port_id');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('subdomains_user_subdomains');
    }
};