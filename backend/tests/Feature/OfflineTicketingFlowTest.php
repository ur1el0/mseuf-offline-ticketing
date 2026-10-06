<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventGate;
use App\Models\EventGateStaffAssignment;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Venue;
use App\Models\VenueGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OfflineTicketingFlowTest extends TestCase
{
    /**
     * A basic feature test example.
     */
    use RefreshDatabase;

    public function test_only_students_can_access_the_student_ticket_wallet(): void
    {
        $users = [
            User::factory()->securityStaff()->create(),
            User::factory()->administrator()->create(),
        ];

        foreach ($users as $user) {
            Sanctum::actingAs($user);

            $this->getJson('/api/v1/student/tickets')->assertForbidden();
        }
    }

    public function test_student_only_receives_their_own_active_ticket(): void
    {
        $venue = Venue::query()->create([
            'name' => 'Test Hall',
            'location_details' => null,
        ]);

        $physicalGate = VenueGate::query()->create([
            'venue_id' => $venue->id,
            'code' => 'NORTH',
            'name' => 'North Gate',
        ]);

        $event = Event::query()->create([
            'venue_id' => $venue->id,
            'name' => 'Test Event',
            'description' => null,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDays(2),
            'status' => Event::STATUS_SCHEDULED,
            'configuration_version' => 1,
        ]);

        $eventGate = EventGate::query()->create([
            'event_id' => $event->id,
            'venue_gate_id' => $physicalGate->id,
            'capacity' => 100,
        ]);

        $claimedGate = VenueGate::query()->create([
            'venue_id' => $venue->id,
            'code' => 'SOUTH',
            'name' => 'South Gate',
        ]);

        $claimedEventGate = EventGate::query()->create([
            'event_id' => $event->id,
            'venue_gate_id' => $claimedGate->id,
            'capacity' => 100,
        ]);

        $student = User::factory()->create();
        $otherStudent = User::factory()->create();

        $ownSecret = str_repeat('a', 40);

        $ownTicket = Ticket::query()->create([
            'user_id' => $student->id,
            'event_gate_id' => $eventGate->id,
            'totp_secret' => $ownSecret,
            'status' => Ticket::STATUS_ISSUED,
        ]);

        $claimedTicket = Ticket::query()->create([
            'user_id' => $student->id,
            'event_gate_id' => $claimedEventGate->id,
            'totp_secret' => str_repeat('c', 40),
            'status' => Ticket::STATUS_CLAIMED,
        ]);

        $otherTicket = Ticket::query()->create([
            'user_id' => $otherStudent->id,
            'event_gate_id' => $eventGate->id,
            'totp_secret' => str_repeat('b', 40),
            'status' => Ticket::STATUS_ISSUED,
        ]);

        Sanctum::actingAs($student);

        $response = $this->getJson('/api/v1/student/tickets')
            ->assertOk()
            ->assertJsonCount(2, 'tickets');

        $visibleTicketIds = array_column($response->json('tickets'), 'id');
        $ticketsById = collect($response->json('tickets'))->keyBy('id');

        $this->assertEqualsCanonicalizing([$ownTicket->id, $claimedTicket->id], $visibleTicketIds);
        $this->assertSame($ownSecret, $ticketsById[$ownTicket->id]['totp_secret']);
        $this->assertNull($ticketsById[$claimedTicket->id]['totp_secret']);
        $this->assertNotContains($otherTicket->id, $visibleTicketIds);
    }

    public function test_staff_receives_only_the_manifest_for_their_assigned_gate(): void
    {
        $venue = Venue::query()->create([
            'name' => 'Test Hall',
            'location_details' => null,
        ]);

        $northGate = VenueGate::query()->create([
            'venue_id' => $venue->id,
            'code' => 'NORTH',
            'name' => 'North Gate',
        ]);

        $southGate = VenueGate::query()->create([
            'venue_id' => $venue->id,
            'code' => 'SOUTH',
            'name' => 'South Gate',
        ]);

        $event = Event::query()->create([
            'venue_id' => $venue->id,
            'name' => 'Test Event',
            'description' => null,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDays(2),
            'status' => Event::STATUS_SCHEDULED,
            'configuration_version' => 1,
        ]);

        $northEventGate = EventGate::query()->create([
            'event_id' => $event->id,
            'venue_gate_id' => $northGate->id,
            'capacity' => 100,
        ]);

        $southEventGate = EventGate::query()->create([
            'event_id' => $event->id,
            'venue_gate_id' => $southGate->id,
            'capacity' => 100,
        ]);

        $staff = User::factory()->securityStaff()->create();

        EventGateStaffAssignment::query()->create([
            'event_gate_id' => $northEventGate->id,
            'user_id' => $staff->id,
        ]);

        $northStudent = User::factory()->create();
        $southStudent = User::factory()->create();

        $northSecret = str_repeat('a', 40);

        $northTicket = Ticket::query()->create([
            'user_id' => $northStudent->id,
            'event_gate_id' => $northEventGate->id,
            'totp_secret' => $northSecret,
            'status' => Ticket::STATUS_ISSUED,
        ]);

        $southTicket = Ticket::query()->create([
            'user_id' => $southStudent->id,
            'event_gate_id' => $southEventGate->id,
            'totp_secret' => str_repeat('b', 40),
            'status' => Ticket::STATUS_ISSUED,
        ]);

        Sanctum::actingAs($staff);

        $response = $this->getJson("/api/v1/gates/{$northEventGate->id}/manifest")
            ->assertOk()
            ->assertJsonPath('gate_id', $northEventGate->id)
            ->assertJsonPath('event_status', Event::STATUS_SCHEDULED)
            ->assertJsonPath('tickets.0.ticket_id', $northTicket->id)
            ->assertJsonPath('tickets.0.totp_secret', $northSecret);

        $this->assertStringContainsString(
            'no-store',
            $response->headers->get('Cache-Control', '')
        );

        $visibleTicketIds = array_column($response->json('tickets'), 'ticket_id');

        $this->assertSame([$northTicket->id], $visibleTicketIds);
        $this->assertNotContains($southTicket->id, $visibleTicketIds);

        $this->getJson("/api/v1/gates/{$southEventGate->id}/manifest")
            ->assertNotFound();
    }
}
