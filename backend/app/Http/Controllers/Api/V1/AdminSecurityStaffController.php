<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreSecurityStaffRequest;
use App\Http\Resources\Api\V1\SecurityStaffResource;
use App\Models\AdminActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
        $actor = $request->user();

        abort_unless($actor instanceof User, 403);

        $staff = DB::transaction(function () use ($validated, $actor): User {
            $staff = new User;
            $staff->name = $validated['name'];
            $staff->email = $validated['email'];
            $staff->student_number = null;
            $staff->role = User::ROLE_SECURITY_STAFF;
            $staff->password = $validated['password'];
            $staff->save();

            AdminActivityLog::query()->create([
                'actor_user_id' => $actor->getKey(),
                'action' => AdminActivityLog::ACTION_SECURITY_STAFF_ACCOUNT_CREATED,
                'subject_type' => 'security_staff',
                'subject_id' => $staff->getKey(),
                'subject_label' => $staff->name.' · '.$staff->email,
                'created_at' => now(),
            ]);

            return $staff;
        });

        return response()->json([
            'staff' => (new SecurityStaffResource($staff))->resolve($request),
        ], 201);
    }
}
