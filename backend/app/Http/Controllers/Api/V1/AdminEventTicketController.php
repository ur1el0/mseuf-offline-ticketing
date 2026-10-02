<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreEventTicketRequest;
use App\Models\Event;
use App\Models\User;
use App\Services\AdminEventTicketIssuanceService;
use Illuminate\Http\JsonResponse;

class AdminEventTicketController extends Controller
{
    public function store(
        StoreEventTicketRequest $request,
        Event $event,
        AdminEventTicketIssuanceService $ticketIssuanceService,
    ): JsonResponse {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        $validated = $request->validated();
        $ticket = $ticketIssuanceService->issue(
            $event,
            (int) $validated['event_gate_id'],
            $validated['student_number'],
            $actor,
        );

        $event->refresh();

        return response()->json([
            'configuration_version' => $event->configuration_version,
            'ticket' => [
                'id' => $ticket->getKey(),
                'student_number' => $ticket->user->student_number,
                'event_gate_id' => $ticket->event_gate_id,
                'status' => $ticket->status,
            ],
        ], 201)->header('Cache-Control', 'no-store');
    }
}
