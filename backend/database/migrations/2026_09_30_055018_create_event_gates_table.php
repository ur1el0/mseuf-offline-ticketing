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
        Schema::create('event_gates', function (Blueprint $table) {
            $table->id();

            $table->foreignId('event_id')
                ->constrained('events')
                ->restrictOnDelete();

            $table->foreignId('venue_gate_id')
                ->constrained('venue_gates')
                ->restrictOnDelete();

            $table->timestampsTz();

            $table->unique(['event_id', 'venue_gate_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('event_gates');
    }
};
