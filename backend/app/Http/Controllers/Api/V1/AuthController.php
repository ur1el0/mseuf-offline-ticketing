<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'identifier' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
            'device_name' => ['sometimes', 'string', 'max:100'],
        ]);

        $identifier = $credentials['identifier'];
        $isEmail = filter_var($identifier, FILTER_VALIDATE_EMAIL) !== false;
        $column = $isEmail ? 'email' : 'student_number';
        $roles = $isEmail
            ? [User::ROLE_SECURITY_STAFF, User::ROLE_ADMINISTRATOR]
            : [User::ROLE_STUDENT];

        $user = User::query()
            ->where($column, $identifier)
            ->whereIn('role', $roles)
            ->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json([
                'message' => 'Invalid credentials.',
            ], 401);
        }

        $deviceName = $credentials['device_name'] ?? 'mseuf-ticketing-app';
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return response()->json([
            'user' => $this->userPayload($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user->currentAccessToken()?->delete();

        return response()->json(['message' => 'Logged out.']);
    }

    /**
     * @return array{id: int, name: string, student_number: string|null, role: string}
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->getKey(),
            'student_number' => $user->student_number,
            'name' => $user->name,
            'role' => $user->role,
        ];
    }
}
