<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

class AdminActivityLogService
{
    /**
     * @param  array{type?: string, event_id?: int|string, from?: string, to?: string, limit?: int|string}  $filters
     * @return array{entries: array<int, array<string, mixed>>, has_more: bool, limit: int}
     */
    public function recent(array $filters): array
    {
        $type = $filters['type'] ?? 'all';
        $limit = (int) ($filters['limit'] ?? 50);
        $entries = [];

        if (in_array($type, ['all', 'account'], true) && ! isset($filters['event_id'])) {
            $entries = array_merge($entries, $this->accountEntries($filters, $limit));
        }

        if (in_array($type, ['all', 'event_change'], true)) {
            $entries = array_merge($entries, $this->eventChangeEntries($filters, $limit));
        }

        if (in_array($type, ['all', 'scan'], true)) {
            $entries = array_merge($entries, $this->scanEntries($filters, $limit));
        }

        if (in_array($type, ['all', 'anomaly'], true)) {
            $entries = array_merge($entries, $this->anomalyEntries($filters, $limit));
        }

        usort($entries, static function (array $first, array $second): int {
            $byTime = $second['_sort_timestamp'] <=> $first['_sort_timestamp'];

            return $byTime !== 0 ? $byTime : strcmp($second['id'], $first['id']);
        });

        $hasMore = count($entries) > $limit;
        $entries = array_slice($entries, 0, $limit);

        foreach ($entries as &$entry) {
            unset($entry['_sort_timestamp']);
        }
        unset($entry);

        return [
            'entries' => $entries,
            'has_more' => $hasMore,
            'limit' => $limit,
        ];
    }

    /**
     * @param  array{type?: string, event_id?: int|string, from?: string, to?: string, limit?: int|string}  $filters
     * @return array<int, array<string, mixed>>
     */
    private function accountEntries(array $filters, int $limit): array
    {
        $query = DB::table('admin_activity_logs as log')
            ->join('users as actor', 'actor.id', '=', 'log.actor_user_id')
            ->whereIn('log.action', [
                'student_account_created',
                'security_staff_account_created',
            ])
            ->select([
                'log.id',
                'log.action',
                'log.subject_label',
                'actor.id as actor_id',
                'actor.name as actor_name',
                'log.created_at as occurred_at',
            ]);

        return $this->rows($query, $filters, 'log.created_at', null, 'log.id', $limit)
            ->map(fn (object $row): array => $this->entry(
                'account:'.$row->id,
                'account',
                null,
                null,
                (int) $row->actor_id,
                $row->actor_name,
                $row->subject_label,
                $row->action,
                'recorded',
                null,
                $row->occurred_at,
            ))
            ->all();
    }

    /**
     * @param  array{type?: string, event_id?: int|string, from?: string, to?: string, limit?: int|string}  $filters
     * @return array<int, array<string, mixed>>
     */
    private function eventChangeEntries(array $filters, int $limit): array
    {
        $query = DB::table('event_change_logs as change')
            ->join('events as event', 'event.id', '=', 'change.event_id')
            ->join('users as actor', 'actor.id', '=', 'change.actor_user_id')
            ->select([
                'change.id',
                'change.event_id',
                'event.name as event_name',
                'change.change_type as action',
                'change.reason as detail',
                'actor.id as actor_id',
                'actor.name as actor_name',
                'change.created_at as occurred_at',
            ]);

        return $this->rows($query, $filters, 'change.created_at', 'change.event_id', 'change.id', $limit)
            ->map(fn (object $row): array => $this->entry(
                'event_change:'.$row->id,
                'event_change',
                (int) $row->event_id,
                $row->event_name,
                (int) $row->actor_id,
                $row->actor_name,
                $row->event_name,
                $row->action,
                'recorded',
                $row->detail,
                $row->occurred_at,
            ))
            ->all();
    }

    /**
     * @param  array{type?: string, event_id?: int|string, from?: string, to?: string, limit?: int|string}  $filters
     * @return array<int, array<string, mixed>>
     */
    private function scanEntries(array $filters, int $limit): array
    {
        $query = DB::table('scan_logs as scan')
            ->join('event_gates as gate', 'gate.id', '=', 'scan.event_gate_id')
            ->join('events as event', 'event.id', '=', 'gate.event_id')
            ->join('venue_gates as physical_gate', 'physical_gate.id', '=', 'gate.venue_gate_id')
            ->join('users as actor', 'actor.id', '=', 'scan.scanned_by_user_id')
            ->select([
                'scan.scan_id',
                'scan.decision',
                'scan.reason_code',
                'scan.is_override',
                'scan.server_received_at as occurred_at',
                'gate.event_id',
                'event.name as event_name',
                'physical_gate.code as gate_code',
                'physical_gate.name as gate_name',
                'actor.id as actor_id',
                'actor.name as actor_name',
            ]);

        return $this->rows($query, $filters, 'scan.server_received_at', 'gate.event_id', 'scan.scan_id', $limit)
            ->map(fn (object $row): array => $this->entry(
                'scan:'.$row->scan_id,
                'scan',
                (int) $row->event_id,
                $row->event_name,
                (int) $row->actor_id,
                $row->actor_name,
                trim($row->gate_code.' · '.$row->gate_name),
                'ticket_scan',
                $row->decision,
                $row->reason_code ?? ((bool) $row->is_override ? 'manual_override' : null),
                $row->occurred_at,
            ))
            ->all();
    }

    /**
     * @param  array{type?: string, event_id?: int|string, from?: string, to?: string, limit?: int|string}  $filters
     * @return array<int, array<string, mixed>>
     */
    private function anomalyEntries(array $filters, int $limit): array
    {
        $query = DB::table('audit_logs as anomaly')
            ->join('event_gates as gate', 'gate.id', '=', 'anomaly.event_gate_id')
            ->join('events as event', 'event.id', '=', 'gate.event_id')
            ->join('venue_gates as physical_gate', 'physical_gate.id', '=', 'gate.venue_gate_id')
            ->join('users as actor', 'actor.id', '=', 'anomaly.scanned_by_user_id')
            ->select([
                'anomaly.id',
                'anomaly.anomaly_type as action',
                'anomaly.server_received_at as occurred_at',
                'gate.event_id',
                'event.name as event_name',
                'physical_gate.code as gate_code',
                'physical_gate.name as gate_name',
                'actor.id as actor_id',
                'actor.name as actor_name',
            ]);

        return $this->rows($query, $filters, 'anomaly.server_received_at', 'gate.event_id', 'anomaly.id', $limit)
            ->map(fn (object $row): array => $this->entry(
                'anomaly:'.$row->id,
                'anomaly',
                (int) $row->event_id,
                $row->event_name,
                (int) $row->actor_id,
                $row->actor_name,
                trim($row->gate_code.' · '.$row->gate_name),
                $row->action,
                'review_required',
                null,
                $row->occurred_at,
            ))
            ->all();
    }

    /**
     * @param  array{type?: string, event_id?: int|string, from?: string, to?: string, limit?: int|string}  $filters
     */
    private function rows(
        Builder $query,
        array $filters,
        string $timestampColumn,
        ?string $eventIdColumn,
        string $idColumn,
        int $limit,
    ) {
        if (isset($filters['event_id'])) {
            if ($eventIdColumn === null) {
                return collect();
            }

            $query->where($eventIdColumn, (int) $filters['event_id']);
        }

        if (isset($filters['from'])) {
            $query->whereDate($timestampColumn, '>=', $filters['from']);
        }

        if (isset($filters['to'])) {
            $query->whereDate($timestampColumn, '<=', $filters['to']);
        }

        return $query
            ->orderByDesc($timestampColumn)
            ->orderByDesc($idColumn)
            ->limit($limit + 1)
            ->get();
    }

    /**
     * @return array<string, mixed>
     */
    private function entry(
        string $id,
        string $type,
        ?int $eventId,
        ?string $eventName,
        ?int $actorId,
        ?string $actorName,
        string $subject,
        string $action,
        string $outcome,
        ?string $detail,
        mixed $occurredAt,
    ): array {
        $timestamp = CarbonImmutable::parse($occurredAt)->utc();

        return [
            'id' => $id,
            'type' => $type,
            'event' => $eventId === null ? null : ['id' => $eventId, 'name' => $eventName],
            'actor' => $actorId === null ? null : ['id' => $actorId, 'name' => $actorName],
            'subject' => $subject,
            'action' => $action,
            'outcome' => $outcome,
            'detail' => $detail,
            'occurred_at' => $timestamp->toIso8601String(),
            '_sort_timestamp' => (float) $timestamp->format('U.u'),
        ];
    }
}
