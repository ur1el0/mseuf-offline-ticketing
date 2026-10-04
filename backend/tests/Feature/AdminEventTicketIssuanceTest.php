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
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminEventTicketIssuanceTest extends TestCase
{
    use RefreshDatabase;

    public function test_administrator_issues_a_ticket_and_records_the_event_change(): void
    {
        $fixture = $this->createFixture();
        Sanctum::actingAs($fixture['admin']);

        $response = $this->issueTicket($fixture, [
            'student_number' => ' '.$fixture['student']->student_number.' ',
        ]);

        $response->assertCreated()
            ->assertJsonPath('configuration_version', 2)
            ->assertJsonPath('ticket.student_number', $fixture['student']->student_number)
            ->assertJsonPath('ticket.event_gate_id', $fixture['eventGate']->id)
            ->assertJsonPath('ticket.status', Ticket::STATUS_ISSUED)
            ->assertJsonMissingPath('ticket.totp_secret');

        $this->assertStringContainsString(
            'no-store',
            $response->headers->get('Cache-Control', ''),
        );

        $ticketId = (int) $response->json('ticket.id');
        $this->assertDatabaseHas('tickets', [
            'id' => $ticketId,
            'user_id' => $fixture['student']->id,
            'event_gate_id' => $fixture['eventGate']->id,
            'status' => Ticket::STATUS_ISSUED,
        ]);

        $ticket = Ticket::query()->findOrFail($ticketId);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{40}$/', $ticket->totp_secret);

        $storedSecret = DB::table('tickets')->where('id', $ticketId)->value('totp_secret');
        $this->assertNotSame($ticket->totp_secret, $storedSecret);

        $this->assertDatabaseHas('events', [
            'id' => $fixture['event']->id,
            'configuration_version' => 2,
        ]);
        $this->assertDatabaseHas('event_change_logs', [
            'event_id' => $fixture['event']->id,
            'actor_user_id' => $fixture['admin']->id,
            'configuration_version' => 2,
            'change_type' => 'ticket_issued',
        ]);

        $change = EventChangeLog::query()
            ->where('event_id', $fixture['event']->id)
            ->where('change_type', 'ticket_issued')
            ->firstOrFail();

        $this->assertNull($change->old_values);
        $this->assertSame($ticketId, $change->new_values['ticket_id']);
        $this->assertSame($fixture['eventGate']->id, $change->new_values['event_gate_id']);
    }

    public function test_only_administrators_can_issue_tickets(): void
    {
        $fixture = $this->createFixture();

        $this->issueTicket($fixture)->assertUnauthorized();

        foreach ([
            User::factory()->create(),
            User::factory()->securityStaff()->create(),
        ] as $user) {
            Sanctum::actingAs($user);

            $this->issueTicket($fixture)->assertForbidden();
        }

        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_active_ticket_cannot_be_issued_twice_for_the_same_student_and_gate(): void
    {
        $fixture = $this->createFixture(capacity: 5);
        Sanctum::actingAs($fixture['admin']);

        foreach ([Ticket::STATUS_ISSUED, Ticket::STATUS_CLAIMED] as $status) {
            $student = User::factory()->create();
            $this->createTicket($student, $fixture['eventGate'], $status);

            $this->issueTicket($fixture, [
                'student_number' => $student->student_number,
            ])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('student_number');
        }

        $this->assertDatabaseCount('tickets', 2);
        $this->assertDatabaseHas('events', [
            'id' => $fixture['event']->id,
            'configuration_version' => 1,
        ]);
        $this->assertDatabaseCount('event_change_logs', 0);
    }

    public function test_issued_and_claimed_tickets_both_consume_gate_capacity(): void
    {
        foreach ([Ticket::STATUS_ISSUED, Ticket::STATUS_CLAIMED] as $status) {
            $fixture = $this->createFixture(capacity: 1);
            Sanctum::actingAs($fixture['admin']);
            $this->createTicket(User::factory()->create(), $fixture['eventGate'], $status);

            $this->issueTicket($fixture)
                ->assertUnprocessable()
                ->assertJsonValidationErrors('event_gate_id');

            $this->assertSame(
                1,
                Ticket::query()->where('event_gate_id', $fixture['eventGate']->id)->count(),
            );
            $this->assertDatabaseHas('events', [
                'id' => $fixture['event']->id,
                'configuration_version' => 1,
            ]);
        }
    }

    public function test_ticket_can_only_be_issued_for_a_gate_on_the_selected_event(): void
    {
        $fixture = $this->createFixture();
        Sanctum::actingAs($fixture['admin']);

        $otherEvent = Event::query()->create([
            'venue_id' => $fixture['venue']->id,
            'name' => 'Another Event',
            'description' => null,
            'starts_at' => now()->addDays(2),
            'ends_at' => now()->addDays(3),
            'status' => Event::STATUS_DRAFT,
            'configuration_version' => 1,
        ]);
        $otherVenueGate = VenueGate::query()->create([
            'venue_id' => $fixture['venue']->id,
            'code' => 'GATE-B',
            'name' => 'Gate B',
        ]);
        $otherEventGate = EventGate::query()->create([
            'event_id' => $otherEvent->id,
            'venue_gate_id' => $otherVenueGate->id,
            'capacity' => 10,
        ]);

        $this->issueTicket($fixture, [
            'event_gate_id' => $otherEventGate->id,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('event_gate_id');

        $this->assertDatabaseCount('tickets', 0);
        $this->assertDatabaseCount('event_change_logs', 0);
    }

    public function test_ticket_can_only_be_issued_to_a_student_account(): void
    {
        $fixture = $this->createFixture();
        Sanctum::actingAs($fixture['admin']);
        $staff = User::factory()->securityStaff()->create([
            'student_number' => 'STAFF-0001',
        ]);

        $this->issueTicket($fixture, [
            'student_number' => $staff->student_number,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('student_number');

        $this->assertDatabaseCount('tickets', 0);
    }

    public function test_cancelled_and_completed_events_reject_ticket_issuance(): void
    {
        foreach ([Event::STATUS_CANCELLED, Event::STATUS_COMPLETED] as $status) {
            $fixture = $this->createFixture(eventStatus: $status);
            Sanctum::actingAs($fixture['admin']);

            $this->issueTicket($fixture)
                ->assertUnprocessable()
                ->assertJsonValidationErrors('event');

            $this->assertDatabaseCount('tickets', 0);
            $this->assertDatabaseCount('event_change_logs', 0);
        }
    }

    public function test_revoked_ticket_can_be_reissued_with_a_new_secret(): void
    {
        $fixture = $this->createFixture(capacity: 1);
        Sanctum::actingAs($fixture['admin']);
        $previousSecret = str_repeat('a', 40);
        $revokedTicket = $this->createTicket(
            $fixture['student'],
            $fixture['eventGate'],
            Ticket::STATUS_REVOKED,
            $previousSecret,
        );

        $response = $this->issueTicket($fixture)->assertCreated();

        $this->assertSame($revokedTicket->id, $response->json('ticket.id'));
        $revokedTicket->refresh();
        $this->assertSame(Ticket::STATUS_ISSUED, $revokedTicket->status);
        $this->assertNotSame($previousSecret, $revokedTicket->totp_secret);
        $this->assertMatchesRegularExpression('/^[a-f0-9]{40}$/', $revokedTicket->totp_secret);

        $change = EventChangeLog::query()
            ->where('event_id', $fixture['event']->id)
            ->where('change_type', 'ticket_issued')
            ->firstOrFail();

        $this->assertSame([
            'ticket_id' => $revokedTicket->id,
            'status' => Ticket::STATUS_REVOKED,
        ], $change->old_values);
        $this->assertSame($revokedTicket->id, $change->new_values['ticket_id']);
        $this->assertDatabaseHas('events', [
            'id' => $fixture['event']->id,
            'configuration_version' => 2,
        ]);
    }

    /**
     * @return array{admin: User, venue: Venue, event: Event, eventGate: EventGate, student: User}
     */
    private function createFixture(
        string $eventStatus = Event::STATUS_DRAFT,
        ?int $capacity = 3,
    ): array {
        $admin = User::factory()->administrator()->create();
        $venue = Venue::query()->create([
            'name' => 'Ticket Test Hall',
            'location_details' => null,
        ]);
        $venueGate = VenueGate::query()->create([
            'venue_id' => $venue->id,
            'code' => 'GATE-A',
            'name' => 'Gate A',
        ]);
        $event = Event::query()->create([
            'venue_id' => $venue->id,
            'name' => 'Ticket Test Event',
            'description' => null,
            'starts_at' => now()->addDay(),
            'ends_at' => now()->addDays(2),
            'status' => $eventStatus,
            'configuration_version' => 1,
        ]);
        $eventGate = EventGate::query()->create([
            'event_id' => $event->id,
            'venue_gate_id' => $venueGate->id,
            'capacity' => $capacity,
        ]);

        return [
            'admin' => $admin,
            'venue' => $venue,
            'event' => $event,
            'eventGate' => $eventGate,
            'student' => User::factory()->create(),
        ];
    }

    private function createTicket(
        User $student,
        EventGate $eventGate,
        string $status,
        ?string $secret = null,
    ): Ticket {
        return Ticket::query()->create([
            'user_id' => $student->id,
            'event_gate_id' => $eventGate->id,
            'totp_secret' => $secret ?? str_repeat('b', 40),
            'status' => $status,
        ]);
    }

    /**
     * @param  array{admin: User, venue: Venue, event: Event, eventGate: EventGate, student: User}  $fixture
     * @param  array<string, mixed>  $overrides
     */
    private function issueTicket(array $fixture, array $overrides = []): TestResponse
    {
        return $this->postJson("/api/v1/admin/events/{$fixture['event']->id}/tickets", array_replace([
            'student_number' => $fixture['student']->student_number,
            'event_gate_id' => $fixture['eventGate']->id,
        ], $overrides));
    }
}
