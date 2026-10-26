<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('testimonials', function (Blueprint $table): void {
            $table->id();
            $table->string('first_name', 80);
            $table->string('last_name', 80)->nullable();
            $table->string('comment_fr', 1000)->nullable();
            $table->string('comment_en', 1000)->nullable();
            $table->string('comment_es', 1000)->nullable();
            $table->string('comment_pt', 1000)->nullable();
            $table->boolean('is_published')->default(false);
            $table->timestamps();
            $table->index(['is_published', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('testimonials');
    }
};
