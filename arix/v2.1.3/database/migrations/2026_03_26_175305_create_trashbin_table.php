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
        Schema::create('trashbin', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('server_id');
            $table->string('trash_root', 191);
            $table->string('trash_name', 191);
            $table->string('original_root', 191);
            $table->string('original_name', 191);
            $table->boolean('is_directory')->default(false);
            $table->timestamps();

            $table->foreign('server_id')->references('id')->on('servers')->onDelete('cascade');
            $table->index('server_id');
            $table->unique(['server_id', 'trash_name']);
            $table->index(['server_id', 'original_root', 'original_name']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('trashbin');
    }
};
