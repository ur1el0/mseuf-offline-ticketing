<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Event;
use App\Models\EventGate;
use App\Models\EventGateStaffAssignment;
use App\Models\Ticket;
use App\Models\User;
use App\Models\Venue;
use App\Models\VenueGate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SyncBatchReconciliationTest extends TestCase
{
    use RefreshDatabase;

    private const VALID_TOTP_SECRET = '3132333435363738393031323334353637383930';

    private const VALID_TOTP_CODE = '287082';

    public function test_assigned_staff_syncs_a_valid_scan_and_claims_the_ticket(): void
    {
        $fixture = $this->createScanFixture();
        Sanctum::actingAs($fixture['staff']);

        $this->syncScans([$this->scanPayload($fixture, (string) Str::uuid())])
            ->assertOk()
            ->assertJsonPath('processed', 1)
            ->assertJsonPath('outcomes.0.decision', 'accepted')
            ->assertJsonPath('outcomes.0.reason_code', null);

        $this->assertDatabaseHas('tickets', [
            'id' => $fixture['ticket']->id,
            'status' => Ticket::STATUS_CLAIMED,
        ]);
        $this->assertDatabaseHas('scan_logs', [
            'ticket_id' => $fixture['ticket']->id,
            'event_gate_id' => $fixture['scannedGate']->id,
            'decision' => 'accepted',
            'reason_code' => null,
        ]);
    }

    public function test_retrying_a_scan_with_the_same_identifier_is_idempotent(): void
    {
        $fixture = $this->createScanFixture();
        Sanctum::actingAs($fixture['staff']);
        $scan = $this->scanPayload($fixture, (string) Str::uuid());

        $this->syncScans([$scan])->assertOk();
        $this->syncScans([$scan])
            ->assertOk()
            ->assertJsonPath('processed', 1)
            ->assertJsonPath('acknowledged_scan_ids.0', $scan['scan_id'])
            ->assertJsonPath('outcomes.0.decision', 'accepted')
            ->assertJsonPath('anomalies_logged', 0);

        $this->assertDatabaseCount('scan_logs', 1);
        $this->assertDatabaseCount('audit_logs', 0);
        $this->assertDatabaseHas('tickets', [
            'id' => $fixture['ticket']->id,
            'status' => Ticket::STATUS_CLAIMED,
        ]);
    }

    public function test_invalid_totp_is_rejected_without_claiming_the_ticket(): void
    {
        $fixture = $this->createScanFixture();
        Sanctum::actingAs($fixture['staff']);
        $scan = $this->scanPayload($fixture, (string) Str::uuid(), ['code' => '123456']);

        $this->syncScans([$scan])
            ->assertOk()
            ->assertJsonPath('outcomes.0.decision', 'rejected')
            ->assertJsonPath('outcomes.0.reason_code', 'INVALID_TICKET_CODE');

        $this->assertDatabaseHas('tickets', [
            'id' => $fixture['ticket']->id,
            'status' => Ticket::STATUS_ISSUED,
        ]);
        $this->assertDatabaseHas('scan_logs', [
            'ticket_id' => $fixture['ticket']->id,
            'decision' => 'rejected',
            'reason_code' => 'INVALID_TICKET_CODE',
        ]);
    }

    public function test_revoked_ticket_is_rejected(): void
    {
        $fixture = $this->createScanFixture(ticketStatus: Ticket::STATUS_REVOKED);
        Sanctum::actingAs($fixture['staff']);

        $this->syncScans([$this->scanPayload($fixture, (string) Str::uuid())])
            ->assertOk()
            ->assertJsonPath('outcomes.0.decision', 'rejected')
            ->assertJsonPath('outcomes.0.reason_code', 'TICKET_REVOKED');

        $this->assertDatabaseHas('tickets', [
            'id' => $fixture['ticket']->id,
            'status' => Ticket::STATUS_REVOKED,
        ]);
    }

    public function test_cancelled_event_scan_is_rejected(): void
    {
        $fixture = $this->createScanFixture(eventStatus: Event::STATUS_CANCELLED);
        Sanctum::actingAs($fixture['staff']);

        $this->syncScans([$this->scanPayload($fixture, (string) Str::uuid())])
            ->assertOk()
            ->assertJsonPath('outcomes.0.decision', 'rejected')
            ->assertJsonPath('outcomes.0.reason_code', 'EVENT_NOT_ACTIVE');

        $this->assertDatabaseHas('tickets', [
            'id' => $fixture['ticket']->id,
            'status' => Ticket::STATUS_ISSUED,
        ]);
    }

    public function test_gate_mismatch_is_rejected_and_written_to_the_audit_log(): void
    {
        $fixture = $this->createScanFixture(scanAtDifferentGate: true);
        Sanctum::actingAs($fixture['staff']);

        $this->syncScans([$this->scanPayload($fixture, (string) Str::uuid())])
            ->assertOk()
            ->assertJsonPath('outcomes.0.decision', 'rejected')
            ->assertJsonPath('outcomes.0.reason_code', 'GATE_MISMATCH')
            ->assertJsonPath('anomalies_logged', 1);

        $this->assertDatabaseHas('audit_logs', [
            'ticket_id' => $fixture['ticket']->id,
            'event_gate_id' => $fixture['scannedGate']->id,
            'scanned_by_user_id' => $fixture['staff']->id,
            'anomaly_type' => AuditLog::ANOMALY_GATE_MISMATCH,
        ]);
        $this->assertDatabaseHas('tickets', [
            'id' => $fixture['ticket']->id,
            'status' => Ticket::STATUS_ISSUED,
        ]);
    }

    /**
     * @return array<string, array{string, bool, bool|int|string}>
     */
    public static function unsupportedOverrideScenarios(): array
    {
        return [
            'revoked ticket with boolean override' => [Ticket::STATUS_REVOKED, false, true],
            'wrong gate with integer override' => [Ticket::STATUS_ISSUED, true, 1],
            'claimed ticket with string override' => [Ticket::STATUS_CLAIMED, false, '1'],
        ];
    }

    #[DataProvider('unsupportedOverrideScenarios')]
    public function test_returns_422_when_a_staff_scan_requests_an_unsupported_override(
        string $ticketStatus,
        bool $scanAtDifferentGate,
        bool|int|string $overrideValue,
    ): void {
        $fixture = $this->createScanFixture(
            ticketStatus: $ticketStatus,
            scanAtDifferentGate: $scanAtDifferentGate,
        );
        Sanctum::actingAs($fixture['staff']);

        $this->syncScans([
            $this->scanPayload($fixture, (string) Str::uuid(), ['is_override' => $overrideValue]),
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('scans.0.is_override');

        $this->assertDatabaseHas('tickets', [
            'id' => $fixture['ticket']->id,
            'status' => $ticketStatus,
        ]);
        $this->assertDatabaseCount('scan_logs', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_staff_cannot_sync_scans_for_an_unassigned_gate(): void
    {
        $fixture = $this->createScanFixture(assignStaffToScannedGate: false);
        Sanctum::actingAs($fixture['staff']);

        $this->syncScans([$this->scanPayload($fixture, (string) Str::uuid())])
            ->assertForbidden();

        $this->assertDatabaseCount('scan_logs', 0);
        $this->assertDatabaseCount('audit_logs', 0);
    }

    public function test_only_authenticated_security_staff_can_submit_scan_batches(): void
    {
        $fixture = $this->createScanFixture();
        $scan = $this->scanPayload($fixture, (string) Str::uuid());

        $this->syncScans([$scan])->assertUnauthorized();

        foreach ([
            User::factory()->create(),
            User::factory()->administrator()->create(),
        ] as $user) {
            Sanctum::actingAs($user);

            $this->syncScans([$scan])->assertForbidden();
        }
    }

    public function test_duplicate_scan_identifiers_in_one_batch_fail_validation(): void
    {
        $fixture = $this->createScanFixture();
        Sanctum::actingAs($fixture['staff']);
        $scan = $this->scanPayload($fixture, (string) Str::uuid());

        $this->syncScans([$scan, $scan])->assertUnprocessable();

        $this->assertDatabaseCount('scan_logs', 0);
    }

    /**
     * @return array{staff: User, ticket: Ticket, scannedGate: EventGate}
     */
    private function createScanFixture(
        string $eventStatus = Event::STATUS_SCHEDULED,
        string $ticketStatus = Ticket::STATUS_ISSUED,
        bool $assignStaffToScannedGate = true,
        bool $scanAtDifferentGate = false,
    ): array {
        $venue = Venue::query()->create([
            'name' => 'Sync Test Hall',
            'location_details' => null,
        ]);

        $ticketVenueGate = VenueGate::query()->create([
            'venue_id' => $venue->id,
            'code' => 'GATE-A',
            'name' => 'Gate A',
        ]);

        $event = Event::query()->create([
            'venue_id' => $venue->id,
            'name' => 'Sync Test Event',
            'description' => null,
            'starts_at' => now()->subHour(),
            'ends_at' => now()->addHour(),
            'status' => $eventStatus,
            'configuration_version' => 1,
        ]);

        $ticketEventGate = EventGate::query()->create([
            'event_id' => $event->id,
            'venue_gate_id' => $ticketVenueGate->id,
            'capacity' => 100,
        ]);
        $scannedGate = $ticketEventGate;

        if ($scanAtDifferentGate) {
            $scannedVenueGate = VenueGate::query()->create([
                'venue_id' => $venue->id,
                'code' => 'GATE-B',
                'name' => 'Gate B',
            ]);

            $scannedGate = EventGate::query()->create([
                'event_id' => $event->id,
                'venue_gate_id' => $scannedVenueGate->id,
                'capacity' => 100,
            ]);
        }

        $staff = User::factory()->securityStaff()->create();

        if ($assignStaffToScannedGate) {
            EventGateStaffAssignment::query()->create([
                'event_gate_id' => $scannedGate->id,
                'user_id' => $staff->id,
            ]);
        }

        $ticket = Ticket::query()->create([
            'user_id' => User::factory()->create()->id,
            'event_gate_id' => $ticketEventGate->id,
            'totp_secret' => self::VALID_TOTP_SECRET,
            'status' => $ticketStatus,
        ]);

        return [
            'staff' => $staff,
            'ticket' => $ticket,
            'scannedGate' => $scannedGate,
        ];
    }

    /**
     * @param  array{staff: User, ticket: Ticket, scannedGate: EventGate}  $fixture
     * @param  array<string, mixed>  $overrides
     * @return array{
     *     scan_id: string,
     *     ticket_id: int,
     *     gate_id: int,
     *     scanned_at: int,
     *     is_override: bool,
     *     event_configuration_version: int,
     *     code_step: int,
     *     code: string
     * }
     */
    private function scanPayload(array $fixture, string $scanId, array $overrides = []): array
    {
        return array_replace([
            'scan_id' => $scanId,
            'ticket_id' => $fixture['ticket']->id,
            'gate_id' => $fixture['scannedGate']->id,
            'scanned_at' => 30_000,
            'is_override' => false,
            'event_configuration_version' => 1,
            'code_step' => 1,
            'code' => self::VALID_TOTP_CODE,
        ], $overrides);
    }

    /**
     * @param  array<int, array<string, mixed>>  $scans
     */
    private function syncScans(array $scans): TestResponse
    {
        return $this->postJson('/api/v1/sync/batch', [
            'device_id' => 'scanner-device-01',
            'scans' => $scans,
        ]);
    }
}
