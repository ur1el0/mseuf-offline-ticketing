<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\AdminActivityLogRequest;
use App\Services\AdminActivityLogService;
use Illuminate\Http\JsonResponse;

class AdminActivityLogController extends Controller
{
    public function __invoke(
        AdminActivityLogRequest $request,
        AdminActivityLogService $activityLogs,
    ): JsonResponse {
        return response()->json($activityLogs->recent($request->validated()))
            ->header('Cache-Control', 'private, no-store');
    }
}
