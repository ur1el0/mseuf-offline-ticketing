<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['event_gate_id', 'user_id'])]
class EventGateStaffAssignment extends Model
{
    public function eventGate(): BelongsTo
    {
        return $this->belongsTo(EventGate::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
