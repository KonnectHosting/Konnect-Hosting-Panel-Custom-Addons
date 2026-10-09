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
        Schema::create('multi_startup_commands', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('egg_id');
            $table->string('name');
            $table->text('command');
            $table->timestamps();

            $table->foreign('egg_id')->references('id')->on('eggs')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('multi_startup_commands');
    }
};
