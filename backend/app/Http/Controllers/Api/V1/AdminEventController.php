<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreEventRequest;
use App\Http\Requests\Api\V1\UpdateEventRequest;
use App\Http\Resources\Api\V1\EventResource;
use App\Models\Event;
use App\Models\User;
use App\Services\AdminEventManagementService;
use Illuminate\Http\JsonResponse;

class AdminEventController extends Controller
{
    public function index(AdminEventManagementService $eventService): JsonResponse
    {
        $events = $eventService->listEvents();

        return response()->json([
            'events' => EventResource::collection($events)->resolve(),
        ]);
    }

    public function store(
        StoreEventRequest $request,
        AdminEventManagementService $eventService,
    ): JsonResponse {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        $event = $eventService->createEvent($request->validated(), $actor);

        return (new EventResource($event))
            ->response($request)
            ->setStatusCode(201);
    }

    public function show(Event $event, AdminEventManagementService $eventService): EventResource
    {
        return new EventResource($eventService->loadEvent($event));
    }

    public function update(
        UpdateEventRequest $request,
        Event $event,
        AdminEventManagementService $eventService,
    ): EventResource {
        $actor = $request->user();

        abort_unless($actor instanceof User, 401);

        $updatedEvent = $eventService->updateEvent($event, $request->validated(), $actor);

        return new EventResource($updatedEvent);
    }
}
