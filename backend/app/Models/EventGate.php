<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['event_id', 'venue_gate_id', 'capacity'])]
class EventGate extends Model
{
    protected function casts(): array
    {
        return [
            'capacity' => 'integer',
        ];
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function venueGate(): BelongsTo
    {
        return $this->belongsTo(VenueGate::class);
    }

    public function staffAssignments(): HasMany
    {
        return $this->hasMany(EventGateStaffAssignment::class);
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class);
    }

    public function scanLogs(): HasMany
    {
        return $this->hasMany(ScanLog::class);
    }
}
