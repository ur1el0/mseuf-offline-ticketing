<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreSecurityStaffRequest;
use App\Http\Resources\Api\V1\SecurityStaffResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSecurityStaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $staff = User::query()
            ->where('role', User::ROLE_SECURITY_STAFF)
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return response()->json([
            'staff' => SecurityStaffResource::collection($staff)->resolve($request),
        ]);
    }

    public function store(StoreSecurityStaffRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $staff = new User;
        $staff->name = $validated['name'];
        $staff->email = $validated['email'];
        $staff->student_number = null;
        $staff->role = User::ROLE_SECURITY_STAFF;
        $staff->password = $validated['password'];
        $staff->save();

        return response()->json([
            'staff' => (new SecurityStaffResource($staff))->resolve($request),
        ], 201);
    }
}
