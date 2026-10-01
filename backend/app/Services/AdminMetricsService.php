<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\EventGate;
use App\Models\ScanLog;
use App\Models\Ticket;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class AdminMetricsService
{
    /**
     * @return array{
     *     total_issued: int,
     *     total_admitted: int,
     *     pending_sync_estimate: null,
     *     gates: Collection<int, EventGate>,
     *     anomalies_count: int,
     *     recent_anomalies: Collection<int, AuditLog>
     * }
     */
    public function metrics(?int $eventId = null): array
    {
        $ticketsQuery = Ticket::query()
            ->whereIn('status', [Ticket::STATUS_ISSUED, Ticket::STATUS_CLAIMED]);

        $scanLogsQuery = ScanLog::query()->where('decision', 'accepted');
        $anomaliesQuery = AuditLog::query();

        if ($eventId !== null) {
            $ticketsQuery->whereHas('eventGate', function (Builder $query) use ($eventId): void {
                $query->where('event_id', $eventId);
            });

            $scanLogsQuery->whereHas('eventGate', function (Builder $query) use ($eventId): void {
                $query->where('event_id', $eventId);
            });

            $anomaliesQuery->whereHas('eventGate', function (Builder $query) use ($eventId): void {
                $query->where('event_id', $eventId);
            });
        }

        $eventGatesQuery = EventGate::query()
            ->with('venueGate:id,name')
            ->withCount([
                'scanLogs as admitted' => function (Builder $query): void {
                    $query->where('decision', 'accepted');
                },
            ])
            ->orderBy('id');

        if ($eventId !== null) {
            $eventGatesQuery->where('event_id', $eventId);
        }

        return [
            'total_issued' => $ticketsQuery->count(),
            'total_admitted' => $scanLogsQuery->count(),
            'pending_sync_estimate' => null,
            'gates' => $eventGatesQuery->get(),
            'anomalies_count' => $anomaliesQuery->count(),
            'recent_anomalies' => $anomaliesQuery
                ->latest('server_received_at')
                ->latest('id')
                ->limit(10)
                ->get(),
        ];
    }
}
