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
        Schema::create('event_change_logs', function (Blueprint $table) {
            $table->id();

            $table->foreignId('event_id')
                ->constrained('events')
                ->restrictOnDelete();

            $table->foreignId('actor_user_id')
                ->constrained('users')
                ->restrictOnDelete();

            $table->integer('configuration_version');
            $table->string('change_type', 40);
            $table->text('reason')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values');
            $table->timestampTz('created_at')->useCurrent();

            $table->unique(['event_id', 'configuration_version']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('event_change_logs');
    }
};
