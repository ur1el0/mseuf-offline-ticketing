<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AdminEventTicketResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Ticket $ticket */
        $ticket = $this->resource;

        return [
            'id' => $ticket->getKey(),
            'student' => [
                'id' => $ticket->user->getKey(),
                'name' => $ticket->user->name,
                'student_number' => $ticket->user->student_number,
            ],
            'gate' => [
                'event_gate_id' => $ticket->event_gate_id,
                'code' => $ticket->eventGate->venueGate->code,
                'name' => $ticket->eventGate->venueGate->name,
            ],
            'status' => $ticket->status,
        ];
    }
}
