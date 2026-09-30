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
        Schema::create('tickets', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained('users')
                ->restrictOnDelete();

            $table->foreignId('event_gate_id')
                ->constrained('event_gates')
                ->restrictOnDelete();

            // Store Laravel-encrypted ciphertext here, never the plaintext TOTP secret.
            $table->text('totp_secret');

            $table->enum('status', ['issued', 'claimed', 'revoked'])
                ->default('issued');

            $table->timestampsTz();

            $table->unique(['user_id', 'event_gate_id']);
            $table->index('event_gate_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tickets');
    }
};
