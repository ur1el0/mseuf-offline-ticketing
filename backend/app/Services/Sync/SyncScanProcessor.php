<?php

namespace App\Services\Sync;

use App\Models\AuditLog;
use App\Models\Event;
use App\Models\EventGate;
use App\Models\Ticket;
use App\Models\User;
use App\Services\TicketQrVerificationService;

class SyncScanProcessor
{
    private const DECISION_ACCEPTED = 'accepted';

    private const DECISION_REJECTED = 'rejected';

    private const REASON_TICKET_REVOKED = 'TICKET_REVOKED';

    private const REASON_EVENT_NOT_ACTIVE = 'EVENT_NOT_ACTIVE';

    private const REASON_INVALID_TICKET_CODE = 'INVALID_TICKET_CODE';

    private const REASON_GATE_MISMATCH = 'GATE_MISMATCH';

    private const REASON_SPLIT_BRAIN_COLLISION = 'SPLIT_BRAIN_COLLISION';

    private const REASON_OVERRIDE_NOT_SUPPORTED = 'MANUAL_OVERRIDE_NOT_SUPPORTED';

    public function __construct(
        private readonly SyncScanRecorder $scanRecorder,
        private readonly TicketQrVerificationService $ticketQrVerificationService,
    ) {}

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
    public function process(
        array $scan,
        Ticket $ticket,
        EventGate $scannedGate,
        User $staff,
        string $deviceId,
    ): array {
        $gateId = (int) $scan['gate_id'];
        $reportedStep = (int) $scan['code_step'];
        $scanTimeStep = intdiv((int) $scan['scanned_at'], 30_000);

        if (filter_var($scan['is_override'], FILTER_VALIDATE_BOOLEAN)) {
            $this->scanRecorder->recordDecision(
                $scan,
                $scannedGate,
                $staff,
                $deviceId,
                self::DECISION_REJECTED,
                self::REASON_OVERRIDE_NOT_SUPPORTED,
            );

            return $this->result(self::DECISION_REJECTED, self::REASON_OVERRIDE_NOT_SUPPORTED);
        }

        if (abs($reportedStep - $scanTimeStep) > 1
            || ! $this->ticketQrVerificationService->matches($ticket, $reportedStep, $scan['code'])) {
            $this->scanRecorder->recordDecision(
                $scan,
                $scannedGate,
                $staff,
                $deviceId,
                self::DECISION_REJECTED,
                self::REASON_INVALID_TICKET_CODE,
            );

            return $this->result(self::DECISION_REJECTED, self::REASON_INVALID_TICKET_CODE);
        }

        $event = $scannedGate->event;
        $wasScannedDuringCompletedEvent = $event->status === Event::STATUS_COMPLETED
            && (int) $scan['scanned_at'] >= $event->starts_at->getTimestamp() * 1000
            && (int) $scan['scanned_at'] <= $event->ends_at->getTimestamp() * 1000;

        if (! in_array($event->status, [Event::STATUS_SCHEDULED, Event::STATUS_IN_PROGRESS], true)
            && ! $wasScannedDuringCompletedEvent) {
            $this->scanRecorder->recordDecision(
                $scan,
                $scannedGate,
                $staff,
                $deviceId,
                self::DECISION_REJECTED,
                self::REASON_EVENT_NOT_ACTIVE,
            );

            return $this->result(self::DECISION_REJECTED, self::REASON_EVENT_NOT_ACTIVE);
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

            return $this->result(self::DECISION_REJECTED, self::REASON_TICKET_REVOKED);
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

            return $this->result(self::DECISION_REJECTED, self::REASON_GATE_MISMATCH, true);
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

            return $this->result(self::DECISION_REJECTED, self::REASON_SPLIT_BRAIN_COLLISION, true);
        }

        $manifestVersion = (int) (
            $scan['event_configuration_version']
            ?? $event->configuration_version
        );
        $hasManifestVersionMismatch = $manifestVersion !== (int) $event->configuration_version;

        if ($hasManifestVersionMismatch) {
            $this->scanRecorder->recordAnomaly(
                $ticket,
                $scannedGate,
                $staff,
                $deviceId,
                AuditLog::ANOMALY_MANIFEST_VERSION_MISMATCH,
                null,
                [
                    'scanner_manifest_version' => $manifestVersion,
                    'current_event_configuration_version' => (int) $event->configuration_version,
                ],
            );
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

        return $this->result(self::DECISION_ACCEPTED, null, $hasManifestVersionMismatch);
    }

    /**
     * @return array{decision: string, reason_code: string|null, anomaly_logged: bool}
     */
    private function result(string $decision, ?string $reasonCode, bool $anomalyLogged = false): array
    {
        return [
            'decision' => $decision,
            'reason_code' => $reasonCode,
            'anomaly_logged' => $anomalyLogged,
        ];
    }
}
