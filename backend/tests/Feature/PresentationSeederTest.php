<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\PresentationSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use LogicException;
use Tests\TestCase;

class PresentationSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_demo_seed_is_idempotent_and_creates_the_local_presentation_basics(): void
    {
        $this->app->detectEnvironment(fn (): string => 'demo');

        config([
            'demo.admin_email' => 'demo-admin@example.test',
            'demo.admin_password' => 'presentation-password-1234',
            'demo.venue_name' => 'Presentation Hall',
            'demo.gate_code' => 'GATE-A',
            'demo.gate_name' => 'Gate A',
        ]);

        $seeder = new PresentationSeeder;
        $seeder->run();
        $seeder->run();

        $admin = User::query()->where('email', 'demo-admin@example.test')->first();

        $this->assertNotNull($admin);
        $this->assertTrue($admin->isAdministrator());
        $this->assertNull($admin->student_number);
        $this->assertTrue(Hash::check('presentation-password-1234', $admin->password));
        $this->assertDatabaseCount('users', 1);
        $this->assertDatabaseCount('venues', 1);
        $this->assertDatabaseCount('venue_gates', 1);
    }

    public function test_demo_seed_refuses_to_run_outside_the_demo_environment(): void
    {
        $this->expectException(LogicException::class);

        (new PresentationSeeder)->run();
    }
}
