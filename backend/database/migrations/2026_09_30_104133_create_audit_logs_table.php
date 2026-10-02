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
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();

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
            $table->string('anomaly_type', 64);
            $table->uuid('colliding_scan_id')->nullable();

            $table->foreign('colliding_scan_id')
                ->references('scan_id')
                ->on('scan_logs')
                ->restrictOnDelete();

            $table->json('metadata')->nullable();
            $table->timestampTz('server_received_at')->useCurrent();

            $table->index(['ticket_id', 'server_received_at']);
            $table->index(['event_gate_id', 'server_received_at']);
            $table->index(['anomaly_type', 'server_received_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
