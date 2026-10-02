<?php

namespace App\Http\Resources\Api\V1;

use App\Models\AuditLog;
use App\Models\EventGate;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminMetricsResource extends JsonResource
{
    public static $wrap = null;

    /**
     * @return array{
     *     total_issued: int,
     *     total_admitted: int,
     *     pending_sync_estimate: null,
     *     gates: array<int, array{gate_id: int, name: string|null, admitted: int, capacity: int|null}>,
     *     anomalies_count: int,
     *     recent_anomalies: array<int, array{id: int, ticket_id: int, anomaly_type: string, device_id: string, server_received_at: string|null}>
     * }
     */
    public function toArray(Request $request): array
    {
        /** @var array{
         *     total_issued: int,
         *     total_admitted: int,
         *     pending_sync_estimate: null,
         *     gates: Collection<int, EventGate>,
         *     anomalies_count: int,
         *     recent_anomalies: Collection<int, AuditLog>
         * } $metrics
         */
        $metrics = $this->resource;

        return [
            'total_issued' => $metrics['total_issued'],
            'total_admitted' => $metrics['total_admitted'],
            'pending_sync_estimate' => $metrics['pending_sync_estimate'],
            'gates' => $metrics['gates']
                ->map(static function (EventGate $eventGate): array {
                    return [
                        'gate_id' => $eventGate->getKey(),
                        'name' => $eventGate->venueGate?->name,
                        'admitted' => (int) $eventGate->admitted,
                        'capacity' => $eventGate->capacity === null
                            ? null
                            : (int) $eventGate->capacity,
                    ];
                })
                ->all(),
            'anomalies_count' => $metrics['anomalies_count'],
            'recent_anomalies' => $metrics['recent_anomalies']
                ->map(static function (AuditLog $anomaly): array {
                    return [
                        'id' => $anomaly->getKey(),
                        'ticket_id' => $anomaly->ticket_id,
                        'anomaly_type' => $anomaly->anomaly_type,
                        'device_id' => $anomaly->device_id,
                        'server_received_at' => $anomaly->server_received_at?->toISOString(),
                    ];
                })
                ->all(),
        ];
    }
}
