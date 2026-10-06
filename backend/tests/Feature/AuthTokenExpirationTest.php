<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTokenExpirationTest extends TestCase
{
    use RefreshDatabase;

    public function test_expired_bearer_token_cannot_access_the_authenticated_user_endpoint(): void
    {
        config(['sanctum.expiration' => 30]);

        $user = User::factory()->administrator()->create();
        $plainTextToken = $user->createToken('expired-token')->plainTextToken;
        $user->tokens()->firstOrFail()->forceFill([
            'created_at' => now()->subMinutes(31),
        ])->save();

        $this->withToken($plainTextToken)
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized();
    }

    public function test_token_within_the_configured_lifetime_can_access_the_authenticated_user_endpoint(): void
    {
        config(['sanctum.expiration' => 30]);

        $user = User::factory()->administrator()->create();
        $plainTextToken = $user->createToken('current-token')->plainTextToken;

        $this->withToken($plainTextToken)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('user.id', $user->id);
    }
}
