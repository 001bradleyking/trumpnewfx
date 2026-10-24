<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('site_settings', function (Blueprint $table): void {
            $table->string('key')->primary();
            $table->text('value');
            $table->timestamps();
        });

        Schema::create('member_payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('offer_key', 32);
            $table->unsignedInteger('amount_usd');
            $table->string('network', 20)->default('TRC20');
            $table->string('status', 20)->default('awaiting_payment');
            $table->string('transaction_id', 128)->nullable()->unique();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });

        Schema::create('audit_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('event_type', 48)->index();
            $table->string('ip_address', 45)->nullable()->index();
            $table->string('path', 255)->nullable();
            $table->string('country', 100)->nullable();
            $table->string('region', 100)->nullable();
            $table->string('city', 100)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
            $table->index(['created_at', 'event_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
        Schema::dropIfExists('member_payments');
        Schema::dropIfExists('site_settings');
    }
};
