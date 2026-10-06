<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'ticket_id',
    'event_gate_id',
    'scanned_by_user_id',
    'device_id',
    'anomaly_type',
    'colliding_scan_id',
    'metadata',
])]
class AuditLog extends Model
{
    public const ANOMALY_SPLIT_BRAIN_COLLISION = 'SPLIT_BRAIN_COLLISION';

    public const ANOMALY_OVERRIDE = 'OVERRIDE';

    public const ANOMALY_GATE_MISMATCH = 'GATE_MISMATCH';

    public const ANOMALY_MANIFEST_VERSION_MISMATCH = 'MANIFEST_VERSION_MISMATCH';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
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

    public function collidingScan(): BelongsTo
    {
        return $this->belongsTo(ScanLog::class, 'colliding_scan_id', 'scan_id');
    }
}
