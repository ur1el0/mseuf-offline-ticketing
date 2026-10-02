<?php

namespace App\Http\Resources\Api\V1;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SyncBatchResultResource extends JsonResource
{
    public static $wrap = null;

    /**
     * @return array{processed: int, acknowledged_scan_ids: array<int, string>, outcomes: array<int, array{scan_id: string, decision: string, reason_code: string|null}>, anomalies_logged: int}
     */
    public function toArray(Request $request): array
    {
        /** @var array{processed: int, acknowledged_scan_ids: array<int, string>, outcomes: array<int, array{scan_id: string, decision: string, reason_code: string|null}>, anomalies_logged: int} $result */
        $result = $this->resource;

        return [
            'processed' => $result['processed'],
            'acknowledged_scan_ids' => $result['acknowledged_scan_ids'],
            'outcomes' => $result['outcomes'],
            'anomalies_logged' => $result['anomalies_logged'],
        ];
    }
}
