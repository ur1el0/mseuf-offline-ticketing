<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Api\V1\SecurityStaffResource;
use App\Http\Resources\Api\V1\VenueResource;
use App\Models\User;
use App\Models\Venue;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminEventOptionsController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $venues = Venue::query()
            ->with(['gates' => fn ($query) => $query->orderBy('name')])
            ->orderBy('name')
            ->get();
        $securityStaff = User::query()
            ->where('role', User::ROLE_SECURITY_STAFF)
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        return response()->json([
            'venues' => VenueResource::collection($venues)->resolve($request),
            'security_staff' => SecurityStaffResource::collection($securityStaff)->resolve($request),
        ]);
    }
}
