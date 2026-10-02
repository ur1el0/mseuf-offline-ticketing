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
        Schema::create('scan_logs', function (Blueprint $table) {
            $table->id();

            // Client-generated UUID makes retrying an offline sync idempotent.
            $table->uuid('scan_id')->unique();

            $table->foreignId('ticket_id')
                ->constrained('tickets')
                ->restrictOnDelete();

            $table->foreignId('event_gate_id')
                ->constrained('event_gates')
                ->restrictOnDelete();

            $table->foreignId('scanned_by_user_id')
                ->constrained('users')
                ->restrictOnDelete();

            $table->string('device_id', 64);
            $table->timestampTz('device_scanned_at');
            $table->integer('event_configuration_version');
            $table->boolean('is_override')->default(false);
            $table->enum('decision', ['accepted', 'rejected']);
            $table->string('reason_code', 64)->nullable();
            $table->timestampTz('server_received_at')->useCurrent();

            $table->index(['ticket_id', 'device_scanned_at']);
            $table->index(['event_gate_id', 'device_scanned_at']);
            $table->index(['scanned_by_user_id', 'server_received_at']);
            $table->index('device_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scan_logs');
    }
};
