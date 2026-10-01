<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'scan_id',
    'ticket_id',
    'event_gate_id',
    'scanned_by_user_id',
    'device_id',
    'device_scanned_at',
    'event_configuration_version',
    'is_override',
    'decision',
    'reason_code',
])]
class ScanLog extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'device_scanned_at' => 'immutable_datetime',
            'event_configuration_version' => 'integer',
            'is_override' => 'boolean',
            'server_received_at' => 'immutable_datetime',
        ];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class);
    }

    public function eventGate(): BelongsTo
    {
        return $this->belongsTo(EventGate::class);
    }

    public function scannedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'scanned_by_user_id');
    }
}
