<?php

namespace App\Http\Resources\Api\V1;

use App\Models\Event;
use App\Models\EventGate;
use App\Models\EventGateStaffAssignment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventResource extends JsonResource
{
    public static $wrap = null;

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Event $event */
        $event = $this->resource;

        return [
            'id' => $event->getKey(),
            'venue_id' => $event->venue_id,
            'venue' => $this->whenLoaded('venue', fn (): array => [
                'id' => $event->venue->getKey(),
                'name' => $event->venue->name,
            ]),
            'name' => $event->name,
            'description' => $event->description,
            'starts_at' => $event->starts_at?->toIso8601String(),
            'ends_at' => $event->ends_at?->toIso8601String(),
            'status' => $event->status,
            'configuration_version' => $event->configuration_version,
            'event_gates' => $this->whenLoaded('eventGates', fn (): array => $event->eventGates
                ->map(static function (EventGate $eventGate): array {
                    return [
                        'id' => $eventGate->getKey(),
                        'venue_gate_id' => $eventGate->venue_gate_id,
                        'code' => $eventGate->venueGate?->code,
                        'name' => $eventGate->venueGate?->name,
                        'capacity' => $eventGate->capacity,
                        'ticket_count' => (int) ($eventGate->active_tickets_count ?? 0),
                        'security_staff' => $eventGate->staffAssignments
                            ->map(static function (EventGateStaffAssignment $assignment): array {
                                return [
                                    'id' => $assignment->user->getKey(),
                                    'name' => $assignment->user->name,
                                    'email' => $assignment->user->email,
                                ];
                            })
                            ->values()
                            ->all(),
                    ];
                })
                ->values()
                ->all()),
        ];
    }
}
