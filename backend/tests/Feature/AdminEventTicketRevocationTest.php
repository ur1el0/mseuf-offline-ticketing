<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventChangeLog;
use App\Models\EventGate;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Venue;
use App\Models\VenueGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminEventTicketRevocationTest extends TestCase
{
    use RefreshDatabase;

    public function test_administrator_revokes_ticket_and_records_the_reason(): void
    {
        $fixture = $this->createFixture();
        $ticket = $this->createTicket($fixture['student'], $fixture['eventGate']);
        Sanctum::actingAs($fixture['admin']);

        $response = $this->revokeTicket($fixture, $ticket, [
            'reason' => '  Student reported a lost phone.  ',
        ]);

        $response->assertOk()
            ->assertJsonPath('configuration_version', 2)
            ->assertJsonPath('ticket.id', $ticket->id)
            ->assertJsonPath('ticket.status', Ticket::STATUS_REVOKED)
            ->assertJsonMissingPath('ticket.totp_secret');

        $this->assertDatabaseHas('tickets', [
            'id' => $ticket->id,
            'status' => Ticket::STATUS_REVOKED,
        ]);
        $this->assertDatabaseHas('events', [
            'id' => $fixture['event']->id,
            'configuration_version' => 2,
        ]);
        $this->assertDatabaseHas('event_change_logs', [
            'event_id' => $fixture['event']->id,
            'actor_user_id' => $fixture['admin']->id,
            'configuration_version' => 2,
            'change_type' => 'ticket_revoked',
            'reason' => 'Student reported a lost phone.',
        ]);

        $change = EventChangeLog::query()
            ->where('event_id', $fixture['event']->id)
            ->where('change_type', 'ticket_revoked')
            ->firstOrFail();

        $this->assertSame([
            'ticket_id' => $ticket->id,
            'status' => Ticket::STATUS_ISSUED,
        ], $change->old_values);
        $this->assertSame([
            'ticket_id' => $ticket->id,
            'event_gate_id' => $fixture['eventGate']->id,
            'status' => Ticket::STATUS_REVOKED,
        ], $change->new_values);
    }

    public function test_revocation_requires_a_reason_and_leaves_the_ticket_unchanged(): void
    {
        $fixture = $this->createFixture();
        $ticket = $this->createTicket($fixture['student'], $fixture['eventGate']);
        Sanctum::actingAs($fixture['admin']);

        $this->revokeTicket($fixture, $ticket, ['reason' => '  '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->assertDatabaseHas('tickets', [
            'id' => $ticket->id,
            'status' => Ticket::STATUS_ISSUED,
        ]);
        $this->assertDatabaseHas('events', [
            'id' => $fixture['event']->id,
            'configuration_version' => 1,
        ]);
        $this->assertDatabaseCount('event_change_logs', 0);
    }

    public function test_only_administrators_can_revoke_tickets(): void
    {
        $fixture = $this->createFixture();
        $ticket = $this->createTicket($fixture['student'], $fixture['eventGate']);

        $this->revokeTicket($fixture, $ticket, ['reason' => 'Lost phone.'])
            ->assertUnauthorized();

        foreach ([
            User::factory()->create(),
            User::factory()->securityStaff()->create(),
        ] as $user) {
            Sanctum::actingAs($user);

            $this->revokeTicket($fixture, $ticket, ['reason' => 'Lost phone.'])
                ->assertForbidden();
        }

        $this->assertDatabaseHas('tickets', [
            'id' => $ticket->id,
            'status' => Ticket::STATUS_ISSUED,
        ]);
        $this->assertDatabaseCount('event_change_logs', 0);
    }

    public function test_ticket_from_another_event_cannot_be_revoked_through_the_selected_event(): void
    {
        $fixture = $this->createFixture();
        $otherEvent = Event::query()->create([
            'venue_id' => $fixture['venue']->id,
            'name' => 'Another event',
            'description' => null,
            'starts_at' => now()->addDays(3),
            'ends_at' => now()->addDays(4),
            'status' => Event::STATUS_DRAFT,
            'configuration_version' => 1,
        ]);
        $otherEventGate = EventGate::query()->create([
            'event_id' => $otherEvent->id,
            'venue_gate_id' => $fixture['venueGate']->id,
            'capacity' => 10,
        ]);
        $ticket = $this->createTicket($fixture['student'], $otherEventGate);
        Sanctum::actingAs($fixture['admin']);

        $this->revokeTicket($fixture, $ticket, ['reason' => 'Wrong event.'])
            ->assertNotFound();

        $this->assertDatabaseHas('tickets', [
            'id' => $ticket->id,
            'status' => Ticket::STATUS_ISSUED,
        ]);
        $this->assertDatabaseCount('event_change_logs', 0);
    }

    public function test_revoked_ticket_cannot_be_revoked_again(): void
    {
        $fixture = $this->createFixture();
        $ticket = $this->createTicket($fixture['student'], $fixture['eventGate'], Ticket::STATUS_REVOKED);
        Sanctum::actingAs($fixture['admin']);

        $this->revokeTicket($fixture, $ticket, ['reason' => 'Duplicate request.'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('ticket');

        $this->assertDatabaseHas('events', [
            'id' => $fixture['event']->id,
            'configuration_version' => 1,
        ]);
        $this->assertDatabaseCount('event_change_logs', 0);
    }

    public function test_administrator_can_list_event_tickets_without_exposing_secrets(): void
    {
        $fixture = $this->createFixture();
        $ticket = $this->createTicket($fixture['student'], $fixture['eventGate']);
        Sanctum::actingAs($fixture['admin']);

        $response = $this->getJson("/api/v1/admin/events/{$fixture['event']->id}/tickets")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $ticket->id)
            ->assertJsonPath('data.0.student.student_number', $fixture['student']->student_number)
            ->assertJsonPath('data.0.gate.code', 'GATE-A')
            ->assertJsonPath('data.0.status', Ticket::STATUS_ISSUED)
            ->assertJsonMissingPath('data.0.totp_secret');

        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control', ''));
    }

    public function test_only_administrators_can_list_event_tickets(): void
    {
        $fixture = $this->createFixture();
        $endpoint = "/api/v1/admin/events/{$fixture['event']->id}/tickets";

        $this->getJson($endpoint)->assertUnauthorized();

        foreach ([
            User::factory()->create(),
            User::factory()->securityStaff()->create(),
        ] as $user) {
            Sanctum::actingAs($user);

            $this->getJson($endpoint)->assertForbidden();
        }
    }

    /**
     * @return array{admin: User, venue: Venue, venueGate: VenueGate, event: Event, eventGate: EventGate, student: User}
     */
    private function createFixture(): array
    {
        $admin = User::factory()->administrator()->create();
        $venue = Venue::query()->create([
            'name' => 'Ticket Revocation Hall',
            'location_details' => null,
        ]);
        $venueGate = VenueGate::query()->create([
            'venue_id' => $venue->id,
            'code' => 'GATE-A',
            'name' => 'Gate A',
        ]);
        $event = Event::query()->create([
            'venue_id' => $venue->id,
            'name' => 'Ticket Revocation Event',
            'description' => null,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDays(2),
            'status' => Event::STATUS_SCHEDULED,
            'configuration_version' => 1,
        ]);
        $eventGate = EventGate::query()->create([
            'event_id' => $event->id,
            'venue_gate_id' => $venueGate->id,
            'capacity' => 10,
        ]);

        return [
            'admin' => $admin,
            'venue' => $venue,
            'venueGate' => $venueGate,
            'event' => $event,
            'eventGate' => $eventGate,
            'student' => User::factory()->create(),
        ];
    }

    private function createTicket(
        User $student,
        EventGate $eventGate,
        string $status = Ticket::STATUS_ISSUED,
    ): Ticket {
        return Ticket::query()->create([
            'user_id' => $student->id,
            'event_gate_id' => $eventGate->id,
            'totp_secret' => str_repeat('b', 40),
            'status' => $status,
        ]);
    }

    /**
     * @param  array{admin: User, venue: Venue, venueGate: VenueGate, event: Event, eventGate: EventGate, student: User}  $fixture
     * @param  array<string, mixed>  $payload
     */
    private function revokeTicket(array $fixture, Ticket $ticket, array $payload): TestResponse
    {
        return $this->patchJson(
            "/api/v1/admin/events/{$fixture['event']->id}/tickets/{$ticket->id}/revoke",
            $payload,
        );
    }
}
