<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('venue_id')
                ->constrained('venues')
                ->restrictOnDelete();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->enum('status', [
                'draft',
                'scheduled',
                'in_progress',
                'postponed',
                'cancelled',
                'completed',  
            ])->default('draft');
            $table->integer('configuration_version')->default(1);
            $table->timestampsTz();
        });
        
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement(<<<'SQL'
                ALTER TABLE events
                ADD CONSTRAINT events_end_after_start_check
                CHECK (ends_at > starts_at)
            SQL);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('events');
    }
};
