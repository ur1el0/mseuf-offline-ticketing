<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('event_gates', function (Blueprint $table): void {
            $table->unsignedInteger('capacity')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('event_gates', function (Blueprint $table): void {
            $table->dropColumn('capacity');
        });
    }
};
