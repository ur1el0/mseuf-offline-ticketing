<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\ReplaceEventGatesRequest;
use App\Http\Resources\Api\V1\EventResource;
use App\Models\Event;
use App\Models\User;
use App\Services\AdminEventGateAssignmentService;

class AdminEventGateAssignmentController extends Controller
{
    public function update(
        ReplaceEventGatesRequest $request,
        Event $event,
        AdminEventGateAssignmentService $assignmentService,
    ): EventResource {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        $validated = $request->validated();
        $updatedEvent = $assignmentService->replaceAssignments(
            $event,
            $validated['gates'],
            $actor,
            $validated['reason'] ?? null,
        );

        return new EventResource($updatedEvent);
    }
}
