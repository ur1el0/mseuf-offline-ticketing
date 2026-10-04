<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Venue;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use LogicException;
use RuntimeException;

class PresentationSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('demo')) {
            throw new LogicException('Presentation data can only be seeded in the demo environment.');
        }

        $adminEmail = config('demo.admin_email');
        $adminPassword = config('demo.admin_password');
        $venueName = config('demo.venue_name');
        $gateCode = config('demo.gate_code');
        $gateName = config('demo.gate_name');

        if (! is_string($adminEmail) || $adminEmail === ''
            || ! is_string($adminPassword) || strlen($adminPassword) < 16
            || ! is_string($venueName) || $venueName === ''
            || ! is_string($gateCode) || $gateCode === ''
            || ! is_string($gateName) || $gateName === '') {
            throw new RuntimeException('Demo administrator and venue settings must be configured before seeding.');
        }

        DB::transaction(function () use ($adminEmail, $adminPassword, $venueName, $gateCode, $gateName): void {
            $admin = User::query()->firstOrNew(['email' => $adminEmail]);

            if ($admin->exists) {
                if (! $admin->isAdministrator()) {
                    throw new LogicException('The configured demo administrator email belongs to a non-administrator account.');
                }
            } else {
                $admin->forceFill([
                    'name' => 'EUEvent Demo Administrator',
                    'student_number' => null,
                    'email' => $adminEmail,
                    'password' => $adminPassword,
                    'role' => User::ROLE_ADMINISTRATOR,
                ])->save();
            }

            $venue = Venue::query()->firstOrCreate(
                ['name' => $venueName],
                ['location_details' => 'Local presentation environment'],
            );

            $venue->gates()->firstOrCreate(
                ['code' => $gateCode],
                ['name' => $gateName],
            );
        });
    }
}
