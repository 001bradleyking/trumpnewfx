<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('member_payments', function (Blueprint $table): void {
            $table->timestamp('expires_at')->nullable()->after('reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('member_payments', function (Blueprint $table): void {
            $table->dropColumn('expires_at');
        });
    }
};
