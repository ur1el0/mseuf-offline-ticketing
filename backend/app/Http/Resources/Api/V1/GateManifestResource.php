<?php

namespace App\Http\Resources\Api\V1;

use App\Models\EventGate;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GateManifestResource extends JsonResource
{
    public static $wrap = null;

    /**
     * @return array{gate_id: int, event_status: string, manifest_version: int, tickets: array<int, array{ticket_id: int, student_number: string|null, totp_secret: string, gate_id: int, status: string}>}
     */
    public function toArray(Request $request): array
    {
        /** @var EventGate $eventGate */
        $eventGate = $this->resource;

        return [
            'gate_id' => $eventGate->getKey(),
            'event_status' => $eventGate->event->status,
            'manifest_version' => $eventGate->event->configuration_version,
            'tickets' => $eventGate->tickets
                ->map(function (Ticket $ticket): array {
                    return [
                        'ticket_id' => $ticket->getKey(),
                        'student_number' => $ticket->user?->student_number,
                        'totp_secret' => $ticket->totp_secret,
                        'gate_id' => $ticket->event_gate_id,
                        'status' => $ticket->status === Ticket::STATUS_ISSUED
                            ? 'unclaimed'
                            : 'claimed',
                    ];
                })
                ->all(),
        ];
    }
}
