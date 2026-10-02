<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\IndexAdminStudentRequest;
use App\Http\Requests\Api\V1\StoreAdminStudentRequest;
use App\Http\Resources\Api\V1\StudentAccountResource;
use App\Models\User;
use App\Services\AdminStudentManagementService;
use Illuminate\Http\JsonResponse;

class AdminStudentController extends Controller
{
    public function index(
        IndexAdminStudentRequest $request,
        AdminStudentManagementService $students,
    ): JsonResponse {
        $paginator = $students->index($request->validated());

        return response()->json([
            'students' => StudentAccountResource::collection($paginator->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
            ],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function store(
        StoreAdminStudentRequest $request,
        AdminStudentManagementService $students,
    ): JsonResponse {
        $actor = $request->user();

        abort_unless($actor instanceof User, 403);

        $student = $students->create($request->validated(), $actor);

        return response()->json([
            'student' => (new StudentAccountResource($student))->resolve($request),
        ], 201)->header('Cache-Control', 'private, no-store');
    }
}
