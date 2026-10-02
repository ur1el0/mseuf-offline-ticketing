<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\SyncBatchRequest;
use App\Http\Resources\Api\V1\SyncBatchResultResource;
use App\Models\User;
use App\Services\SyncReconciliationService;
use Illuminate\Http\JsonResponse;

class SyncBatchController extends Controller
{
    public function __invoke(
        SyncBatchRequest $request,
        SyncReconciliationService $syncReconciliationService,
    ): JsonResponse {
        $staff = $request->user();

        if (! $staff instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $validated = $request->validated();
        $result = $syncReconciliationService->reconcile(
            $staff,
            $validated['device_id'],
            $validated['scans'],
        );

        return (new SyncBatchResultResource($result))->response($request);
    }
}
