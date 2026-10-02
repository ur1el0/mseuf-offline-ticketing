<?php

namespace App\Services;

use App\Models\Event;
use App\Models\EventGate;
use App\Models\EventGateStaffAssignment;
use App\Models\ScanLog;
use App\Models\Ticket;
use App\Models\User;
use App\Services\Sync\SyncScanProcessor;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\DB;

class SyncReconciliationService
{
    public function __construct(private readonly SyncScanProcessor $scanProcessor) {}

    /**
     * @param array<int, array{
     *     scan_id: string,
     *     ticket_id: int|string,
     *     gate_id: int|string,
     *     scanned_at: int|string,
     *     is_override: bool|int|string,
     *     event_configuration_version?: int|string|null,
     *     code_step: int|string,
     *     code: string
     * }> $scans
     * @return array{processed: int, acknowledged_scan_ids: array<int, string>, outcomes: array<int, array{scan_id: string, decision: string, reason_code: string|null}>, anomalies_logged: int}
     */
    public function reconcile(User $staff, string $deviceId, array $scans): array
    {
        return DB::transaction(function () use ($staff, $deviceId, $scans): array {
            $scanIds = array_column($scans, 'scan_id');
            $existingScans = ScanLog::query()
                ->whereIn('scan_id', $scanIds)
                ->get(['scan_id', 'decision', 'reason_code'])
                ->keyBy('scan_id');
            $outcomesById = [];

            foreach ($existingScans as $existingScan) {
                $outcomesById[$existingScan->scan_id] = [
                    'decision' => $existingScan->decision,
                    'reason_code' => $existingScan->reason_code,
                ];
            }

            $pendingScans = array_values(array_filter(
                $scans,
                static fn (array $scan): bool => ! $existingScans->has($scan['scan_id']),
            ));

            if ($pendingScans === []) {
                return $this->response($scanIds, 0, $outcomesById);
            }

            $gateIds = array_values(array_unique(array_map(
                static fn (array $scan): int => (int) $scan['gate_id'],
                $pendingScans,
            )));
            sort($gateIds, SORT_NUMERIC);

            $assignedGateIds = EventGateStaffAssignment::query()
                ->where('user_id', $staff->getKey())
                ->whereIn('event_gate_id', $gateIds)
                ->pluck('event_gate_id')
                ->map(static fn (mixed $gateId): int => (int) $gateId)
                ->all();

            if (array_diff($gateIds, $assignedGateIds) !== []) {
                throw new AuthorizationException('You are not assigned to every gate in this batch.');
            }

            $gateContexts = EventGate::query()
                ->whereIn('id', $gateIds)
                ->orderBy('event_id')
                ->orderBy('id')
                ->get(['id', 'event_id']);
            $eventIds = $gateContexts->pluck('event_id')
                ->map(static fn (mixed $eventId): int => (int) $eventId)
                ->unique()
                ->sort()
                ->values()
                ->all();
            $events = Event::query()
                ->whereIn('id', $eventIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');
            $eventGates = EventGate::query()
                ->whereIn('id', $gateIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            foreach ($eventGates as $eventGate) {
                $eventGate->setRelation('event', $events->get($eventGate->event_id));
            }
            $eventGates = $eventGates->keyBy('id');

            $lockedAssignedGateIds = EventGateStaffAssignment::query()
                ->where('user_id', $staff->getKey())
                ->whereIn('event_gate_id', $gateIds)
                ->orderBy('event_gate_id')
                ->lockForUpdate()
                ->pluck('event_gate_id')
                ->map(static fn (mixed $gateId): int => (int) $gateId)
                ->all();

            if (array_diff($gateIds, $lockedAssignedGateIds) !== []) {
                throw new AuthorizationException('You are not assigned to every gate in this batch.');
            }

            $ticketIds = array_values(array_unique(array_map(
                static fn (array $scan): int => (int) $scan['ticket_id'],
                $pendingScans,
            )));
            sort($ticketIds, SORT_NUMERIC);

            $tickets = Ticket::query()
                ->whereIn('id', $ticketIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            $persistedAfterLock = ScanLog::query()
                ->whereIn('scan_id', array_column($pendingScans, 'scan_id'))
                ->get(['scan_id', 'decision', 'reason_code'])
                ->keyBy('scan_id');

            foreach ($persistedAfterLock as $persistedScan) {
                $outcomesById[$persistedScan->scan_id] = [
                    'decision' => $persistedScan->decision,
                    'reason_code' => $persistedScan->reason_code,
                ];
            }

            $anomaliesLogged = 0;

            foreach ($pendingScans as $scan) {
                $scanId = $scan['scan_id'];

                if ($persistedAfterLock->has($scanId)) {
                    continue;
                }

                $ticketId = (int) $scan['ticket_id'];
                $gateId = (int) $scan['gate_id'];
                $ticket = $tickets->get($ticketId);
                $scannedGate = $eventGates->get($gateId);

                if (! $ticket instanceof Ticket) {
                    throw (new ModelNotFoundException)->setModel(Ticket::class, [$ticketId]);
                }

                if (! $scannedGate instanceof EventGate) {
                    throw (new ModelNotFoundException)->setModel(EventGate::class, [$gateId]);
                }

                $outcome = $this->scanProcessor->process($scan, $ticket, $scannedGate, $staff, $deviceId);
                $anomaliesLogged += $outcome['anomaly_logged'] ? 1 : 0;
                $outcomesById[$scanId] = [
                    'decision' => $outcome['decision'],
                    'reason_code' => $outcome['reason_code'],
                ];
            }

            return $this->response($scanIds, $anomaliesLogged, $outcomesById);
        }, 3);
    }

    /**
     * @param  array<int, string>  $scanIds
     * @param  array<string, array{decision: string, reason_code: string|null}>  $outcomesById
     * @return array{processed: int, acknowledged_scan_ids: array<int, string>, outcomes: array<int, array{scan_id: string, decision: string, reason_code: string|null}>, anomalies_logged: int}
     */
    private function response(array $scanIds, int $anomaliesLogged, array $outcomesById): array
    {
        $outcomes = [];

        foreach ($scanIds as $scanId) {
            if (! isset($outcomesById[$scanId])) {
                throw new \LogicException('A scan acknowledgement is missing its server decision.');
            }

            $outcomes[] = [
                'scan_id' => $scanId,
                'decision' => $outcomesById[$scanId]['decision'],
                'reason_code' => $outcomesById[$scanId]['reason_code'],
            ];
        }

        return [
            'processed' => count($scanIds),
            'acknowledged_scan_ids' => $scanIds,
            'outcomes' => $outcomes,
            'anomalies_logged' => $anomaliesLogged,
        ];
    }
}
