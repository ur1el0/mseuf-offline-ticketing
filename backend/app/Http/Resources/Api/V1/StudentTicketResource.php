<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Event;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StudentTicketResource extends JsonResource
{
    public static $wrap = null;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Ticket $ticket */
        $ticket = $this->resource;
        $eventGate = $ticket->eventGate;
        $event = $eventGate->event;
        $isUsable = in_array($ticket->status, [Ticket::STATUS_ISSUED, Ticket::STATUS_CLAIMED], true)
            && in_array($event->status, [Event::STATUS_SCHEDULED, Event::STATUS_IN_PROGRESS], true);

        return [
            'id' => $ticket->getKey(),
            'status' => $ticket->status,
            'totp_secret' => $isUsable ? $ticket->totp_secret : null,
            'gate' => [
                'id' => $eventGate->getKey(),
                'code' => $eventGate->venueGate->code,
                'name' => $eventGate->venueGate->name,
            ],
            'event' => [
                'id' => $event->getKey(),
                'name' => $event->name,
                'starts_at' => $event->starts_at?->toIso8601String(),
                'ends_at' => $event->ends_at?->toIso8601String(),
                'status' => $event->status,
                'venue_name' => $event->venue->name,
            ],
        ];
    }
}
