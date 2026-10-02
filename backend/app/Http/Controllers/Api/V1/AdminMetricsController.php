<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AdminMetricsRequest;
use App\Http\Resources\Api\V1\AdminMetricsResource;
use App\Services\AdminMetricsService;
use Illuminate\Http\JsonResponse;

class AdminMetricsController extends Controller
{
    public function __invoke(
        AdminMetricsRequest $request,
        AdminMetricsService $adminMetricsService,
    ): JsonResponse {
        $validated = $request->validated();
        $eventId = isset($validated['event_id'])
            ? (int) $validated['event_id']
            : null;

        return (new AdminMetricsResource($adminMetricsService->metrics($eventId)))
            ->response($request);
    }
}
