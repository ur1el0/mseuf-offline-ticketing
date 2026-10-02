<?php

namespace App\Services\Sync;

use App\Models\AuditLog;
use App\Models\EventGate;
use App\Models\Ticket;
use App\Models\User;

class SyncScanProcessor
{
    private const DECISION_ACCEPTED = 'accepted';

    private const DECISION_REJECTED = 'rejected';

    private const REASON_TICKET_REVOKED = 'TICKET_REVOKED';

    private const REASON_GATE_MISMATCH = 'GATE_MISMATCH';

    private const REASON_SPLIT_BRAIN_COLLISION = 'SPLIT_BRAIN_COLLISION';

    public function __construct(private readonly SyncScanRecorder $scanRecorder) {}

    /**
     * @param array{
     *     scan_id: string,
     *     ticket_id: int|string,
     *     gate_id: int|string,
     *     scanned_at: int|string,
     *     is_override: bool|int|string,
     *     event_configuration_version?: int|string|null
     * } $scan
     */
    public function process(
        array $scan,
        Ticket $ticket,
        EventGate $scannedGate,
        User $staff,
        string $deviceId,
    ): bool {
        $gateId = (int) $scan['gate_id'];

        if ((bool) $scan['is_override']) {
            $ticketStatusBefore = $ticket->status;

            if ($ticketStatusBefore === Ticket::STATUS_ISSUED) {
                $ticket->status = Ticket::STATUS_CLAIMED;
                $ticket->save();
            }

            $this->scanRecorder->recordDecision(
                $scan,
                $scannedGate,
                $staff,
                $deviceId,
                self::DECISION_ACCEPTED,
                null,
            );

            $this->scanRecorder->recordAnomaly(
                $ticket,
                $scannedGate,
                $staff,
                $deviceId,
                AuditLog::ANOMALY_OVERRIDE,
                null,
                [
                    'ticket_status_before' => $ticketStatusBefore,
                    'ticket_event_gate_id' => (int) $ticket->event_gate_id,
                    'is_gate_mismatch' => (int) $ticket->event_gate_id !== $gateId,
                ],
            );

            return true;
        }

        if ($ticket->status === Ticket::STATUS_REVOKED) {
            $this->scanRecorder->recordDecision(
                $scan,
                $scannedGate,
                $staff,
                $deviceId,
                self::DECISION_REJECTED,
                self::REASON_TICKET_REVOKED,
            );

            return false;
        }

        if ((int) $ticket->event_gate_id !== $gateId) {
            $this->scanRecorder->recordDecision(
                $scan,
                $scannedGate,
                $staff,
                $deviceId,
                self::DECISION_REJECTED,
                self::REASON_GATE_MISMATCH,
            );

            $this->scanRecorder->recordAnomaly(
                $ticket,
                $scannedGate,
                $staff,
                $deviceId,
                AuditLog::ANOMALY_GATE_MISMATCH,
                null,
                [
                    'ticket_event_gate_id' => (int) $ticket->event_gate_id,
                    'scanned_event_gate_id' => $gateId,
                ],
            );

            return true;
        }

        if ($ticket->status === Ticket::STATUS_CLAIMED) {
            $scanLog = $this->scanRecorder->recordDecision(
                $scan,
                $scannedGate,
                $staff,
                $deviceId,
                self::DECISION_REJECTED,
                self::REASON_SPLIT_BRAIN_COLLISION,
            );

            $this->scanRecorder->recordAnomaly(
                $ticket,
                $scannedGate,
                $staff,
                $deviceId,
                AuditLog::ANOMALY_SPLIT_BRAIN_COLLISION,
                $scanLog->scan_id,
                [
                    'ticket_status_before' => Ticket::STATUS_CLAIMED,
                ],
            );

            return true;
        }

        $ticket->status = Ticket::STATUS_CLAIMED;
        $ticket->save();

        $this->scanRecorder->recordDecision(
            $scan,
            $scannedGate,
            $staff,
            $deviceId,
            self::DECISION_ACCEPTED,
            null,
        );

        return false;
    }
}
