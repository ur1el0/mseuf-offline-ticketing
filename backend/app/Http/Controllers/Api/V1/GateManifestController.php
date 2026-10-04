<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\GateManifestResource;
use App\Models\Event;
use App\Models\EventGate;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GateManifestController extends Controller
{
    public function __invoke(Request $request, int $gateId): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $eventGate = EventGate::query()
            ->whereKey($gateId)
            ->whereHas('staffAssignments', function (Builder $query) use ($user): void {
                $query->where('user_id', $user->getKey());
            })
            ->with('event')
            ->firstOrFail();

        if (! in_array($eventGate->event->status, [Event::STATUS_SCHEDULED, Event::STATUS_IN_PROGRESS], true)) {
            return response()->json([
                'message' => 'A scanner manifest is available only for scheduled or in-progress events.',
            ], 409)->header('Cache-Control', 'no-store');
        }

        $eventGate->load([
            'tickets' => function (HasMany $query): void {
                $query
                    ->whereIn('status', [Ticket::STATUS_ISSUED, Ticket::STATUS_CLAIMED])
                    ->with('user:id,student_number')
                    ->orderBy('id');
            },
        ]);

        return (new GateManifestResource($eventGate))
            ->response($request)
            ->header('Cache-Control', 'no-store');
    }
}
