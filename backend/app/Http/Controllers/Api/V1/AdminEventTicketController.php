<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\RevokeEventTicketRequest;
use App\Http\Requests\Api\V1\StoreEventTicketRequest;
use App\Http\Resources\Api\V1\AdminEventTicketResource;
use App\Models\Event;
use App\Models\Ticket;
use App\Models\User;
use App\Services\AdminEventTicketIssuanceService;
use App\Services\AdminEventTicketRevocationService;
use Illuminate\Http\JsonResponse;

class AdminEventTicketController extends Controller
{
    public function index(
        Event $event,
        AdminEventTicketRevocationService $ticketRevocationService,
    ): JsonResponse {
        return AdminEventTicketResource::collection($ticketRevocationService->listForEvent($event))
            ->response()
            ->header('Cache-Control', 'private, no-store');
    }

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

    public function revoke(
        RevokeEventTicketRequest $request,
        Event $event,
        Ticket $ticket,
        AdminEventTicketRevocationService $ticketRevocationService,
    ): JsonResponse {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        $revokedTicket = $ticketRevocationService->revoke(
            $event,
            (int) $ticket->getKey(),
            $request->validated('reason'),
            $actor,
        );
        $event->refresh();

        return response()->json([
            'configuration_version' => $event->configuration_version,
            'ticket' => (new AdminEventTicketResource($revokedTicket))->resolve($request),
        ])->header('Cache-Control', 'private, no-store');
    }
}
