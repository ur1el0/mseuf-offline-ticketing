<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\EventGate;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssignedGatesController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $assignments = EventGate::query()
            ->whereHas('staffAssignments', function (Builder $query) use ($user): void {
                $query->where('user_id', $user->getKey());
            })
            ->with([
                'event:id,venue_id,name,starts_at,ends_at,status,configuration_version',
                'venueGate:id,code,name',
            ])
            ->withCount([
                'tickets as ticket_count' => function (Builder $query): void {
                    $query->whereIn('status', [Ticket::STATUS_ISSUED, Ticket::STATUS_CLAIMED]);
                },
            ])
            ->get()
            ->sortBy(fn (EventGate $eventGate): int => $eventGate->event->starts_at?->timestamp ?? PHP_INT_MAX)
            ->values()
            ->map(fn (EventGate $eventGate): array => [
                'gate_id' => $eventGate->getKey(),
                'gate_code' => $eventGate->venueGate->code,
                'gate_name' => $eventGate->venueGate->name,
                'event_id' => $eventGate->event->getKey(),
                'event_name' => $eventGate->event->name,
                'event_status' => $eventGate->event->status,
                'starts_at' => $eventGate->event->starts_at?->toIso8601String(),
                'ends_at' => $eventGate->event->ends_at?->toIso8601String(),
                'manifest_version' => $eventGate->event->configuration_version,
                'ticket_count' => $eventGate->ticket_count,
            ])
            ->all();

        return response()->json(['assignments' => $assignments])
            ->header('Cache-Control', 'private, no-store');
    }
}
