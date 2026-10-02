<?php

namespace App\Services\Sync;

use App\Models\AuditLog;
use App\Models\EventGate;
use App\Models\ScanLog;
use App\Models\Ticket;
use App\Models\User;
use Carbon\CarbonImmutable;

class SyncScanRecorder
{
    /**
     * @param array{
     *     scan_id: string,
     *     ticket_id: int|string,
     *     gate_id: int|string,
     *     scanned_at: int|string,
     *     is_override: bool|int|string,
     *     event_configuration_version?: int|string|null,
     *     code_step: int|string,
     *     code: string
     * } $scan
     */
    public function recordDecision(
        array $scan,
        EventGate $scannedGate,
        User $staff,
        string $deviceId,
        string $decision,
        ?string $reasonCode,
    ): ScanLog {
        return ScanLog::query()->create([
            'scan_id' => $scan['scan_id'],
            'ticket_id' => (int) $scan['ticket_id'],
            'event_gate_id' => $scannedGate->getKey(),
            'scanned_by_user_id' => $staff->getKey(),
            'device_id' => $deviceId,
            'device_scanned_at' => CarbonImmutable::createFromTimestampMs(
                (int) $scan['scanned_at'],
                'UTC',
            ),
            'event_configuration_version' => (int) (
                $scan['event_configuration_version']
                ?? $scannedGate->event->configuration_version
            ),
            'is_override' => (bool) $scan['is_override'],
            'decision' => $decision,
            'reason_code' => $reasonCode,
        ]);
    }

    /**
     * @param  array<string, bool|int|string>  $metadata
     */
    public function recordAnomaly(
        Ticket $ticket,
        EventGate $scannedGate,
        User $staff,
        string $deviceId,
        string $anomalyType,
        ?string $collidingScanId,
        array $metadata,
    ): void {
        AuditLog::query()->create([
            'ticket_id' => $ticket->getKey(),
            'event_gate_id' => $scannedGate->getKey(),
            'scanned_by_user_id' => $staff->getKey(),
            'device_id' => $deviceId,
            'anomaly_type' => $anomalyType,
            'colliding_scan_id' => $collidingScanId,
            'metadata' => $metadata,
        ]);
    }
}
