<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\StudentTicketResource;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudentTicketController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $student = $request->user();

        if (! $student instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $tickets = Ticket::query()
            ->where('user_id', $student->getKey())
            ->with(['eventGate.event.venue', 'eventGate.venueGate'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'tickets' => StudentTicketResource::collection($tickets)->resolve($request),
        ])->header('Cache-Control', 'no-store');
    }
}
