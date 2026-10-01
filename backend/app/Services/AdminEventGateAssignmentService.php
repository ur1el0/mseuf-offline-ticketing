<?php

namespace App\Services;

use App\Models\Event;
use App\Models\EventChangeLog;
use App\Models\EventGate;
use App\Models\EventGateStaffAssignment;
use App\Models\User;
use App\Models\VenueGate;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminEventGateAssignmentService
{
    public function __construct(
        private readonly AdminEventManagementService $eventService,
    ) {}

    /**
     * @param  array<int, array{venue_gate_id: int|string, capacity?: int|string|null, security_staff_ids: array<int, int|string>}>  $gateInput
     */
    public function replaceAssignments(
        Event $event,
        array $gateInput,
        User $actor,
        ?string $reason,
    ): Event {
        return DB::transaction(function () use ($event, $gateInput, $actor, $reason): Event {
            $lockedEvent = Event::query()
                ->whereKey($event->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($lockedEvent->status, [Event::STATUS_CANCELLED, Event::STATUS_COMPLETED], true)) {
                throw ValidationException::withMessages([
                    'gates' => 'Gate assignments are frozen for cancelled or completed events.',
                ]);
            }

            $desired = $this->normalizeInput($gateInput);
            $venueGateIds = array_keys($desired);
            $physicalGates = VenueGate::query()
                ->where('venue_id', $lockedEvent->venue_id)
                ->whereIn('id', $venueGateIds)
                ->get()
                ->keyBy('id');

            if ($physicalGates->count() !== count($venueGateIds)) {
                throw ValidationException::withMessages([
                    'gates' => 'Every selected gate must belong to this event venue.',
                ]);
            }

            $existing = EventGate::query()
                ->where('event_id', $lockedEvent->getKey())
                ->with('staffAssignments')
                ->orderBy('id')
                ->lockForUpdate()
                ->get()
                ->keyBy('venue_gate_id');
            $existingSnapshot = $this->snapshot($existing);
            $existingGateIds = $existing->keys()->map(static fn ($id): int => (int) $id)->all();

            if ($lockedEvent->status !== Event::STATUS_DRAFT) {
                $removedGateIds = array_diff($existingGateIds, $venueGateIds);
                if ($removedGateIds !== []) {
                    throw ValidationException::withMessages([
                        'gates' => 'After scheduling, gate assignments may be expanded but existing gates cannot be removed because scanners may hold offline manifests.',
                    ]);
                }

                foreach ($existing as $venueGateId => $eventGate) {
                    $assignedIds = $eventGate->staffAssignments
                        ->pluck('user_id')
                        ->map(static fn ($id): int => (int) $id)
                        ->all();
                    $desiredIds = $desired[(int) $venueGateId]['security_staff_ids'] ?? [];
                    if (array_diff($assignedIds, $desiredIds) !== []) {
                        throw ValidationException::withMessages([
                            'gates' => 'After scheduling, security assignments may be added but existing scanner access cannot be revoked through this endpoint.',
                        ]);
                    }
                }
            }

            $this->assertCapacityChangesAllowed($existing, $desired);
            $desiredSnapshot = $this->snapshotDesired($desired);

            if ($existingSnapshot === $desiredSnapshot) {
                return $this->eventService->loadEvent($lockedEvent);
            }

            if ($lockedEvent->status !== Event::STATUS_DRAFT && $this->eventService->cleanReason($reason) === null) {
                throw ValidationException::withMessages([
                    'reason' => 'Provide a reason when changing gate assignments for a scheduled event.',
                ]);
            }

            $this->removeDraftAssignments($lockedEvent, $existing, $desired);

            foreach ($desired as $venueGateId => $configuration) {
                /** @var EventGate|null $eventGate */
                $eventGate = $existing->get($venueGateId);
                if (! $eventGate instanceof EventGate) {
                    $eventGate = EventGate::query()->create([
                        'event_id' => $lockedEvent->getKey(),
                        'venue_gate_id' => $venueGateId,
                        'capacity' => $configuration['capacity'],
                    ]);
                } elseif ($eventGate->capacity !== $configuration['capacity']) {
                    $eventGate->capacity = $configuration['capacity'];
                    $eventGate->save();
                }

                $this->syncStaffAssignments(
                    $eventGate,
                    $configuration['security_staff_ids'],
                    $lockedEvent->status === Event::STATUS_DRAFT,
                );
            }

            $lockedEvent->configuration_version++;
            $lockedEvent->save();

            EventChangeLog::query()->create([
                'event_id' => $lockedEvent->getKey(),
                'actor_user_id' => $actor->getKey(),
                'configuration_version' => $lockedEvent->configuration_version,
                'change_type' => 'gate_assignments_changed',
                'reason' => $this->eventService->cleanReason($reason),
                'old_values' => ['gates' => $existingSnapshot],
                'new_values' => ['gates' => $desiredSnapshot],
            ]);

            return $this->eventService->loadEvent($lockedEvent);
        }, 3);
    }

    /**
     * @param  array<int, array{venue_gate_id: int|string, capacity?: int|string|null, security_staff_ids: array<int, int|string>}>  $gateInput
     * @return array<int, array{capacity: int|null, security_staff_ids: array<int, int>}>
     */
    private function normalizeInput(array $gateInput): array
    {
        $desired = [];
        foreach ($gateInput as $configuration) {
            $venueGateId = (int) $configuration['venue_gate_id'];
            $staffIds = array_values(array_unique(array_map('intval', $configuration['security_staff_ids'])));
            sort($staffIds, SORT_NUMERIC);
            $capacity = $configuration['capacity'] ?? null;
            $desired[$venueGateId] = [
                'capacity' => $capacity === null ? null : (int) $capacity,
                'security_staff_ids' => $staffIds,
            ];
        }

        ksort($desired, SORT_NUMERIC);

        return $desired;
    }

    /**
     * @param  Collection<int|string, EventGate>  $existing
     * @param  array<int, array{capacity: int|null, security_staff_ids: array<int, int>}>  $desired
     */
    private function assertCapacityChangesAllowed(Collection $existing, array $desired): void
    {
        foreach ($existing as $venueGateId => $eventGate) {
            $newCapacity = $desired[(int) $venueGateId]['capacity'] ?? null;
            if ($newCapacity === null || ($eventGate->capacity !== null && $newCapacity >= $eventGate->capacity)) {
                continue;
            }

            $acceptedAdmissions = $eventGate->scanLogs()->where('decision', 'accepted')->count();
            if ($newCapacity < $acceptedAdmissions) {
                throw ValidationException::withMessages([
                    'gates' => 'Capacity cannot be reduced below admissions already synchronized for that gate.',
                ]);
            }
        }
    }

    /**
     * @param  Collection<int|string, EventGate>  $existing
     * @param  array<int, array{capacity: int|null, security_staff_ids: array<int, int>}>  $desired
     */
    private function removeDraftAssignments(Event $event, Collection $existing, array $desired): void
    {
        if ($event->status !== Event::STATUS_DRAFT) {
            return;
        }

        foreach ($existing as $venueGateId => $eventGate) {
            if (isset($desired[(int) $venueGateId])) {
                continue;
            }

            if ($eventGate->tickets()->exists() || $eventGate->scanLogs()->exists()) {
                throw ValidationException::withMessages([
                    'gates' => 'A gate with tickets or scan history cannot be removed from an event.',
                ]);
            }

            $eventGate->staffAssignments()->delete();
            $eventGate->delete();
        }
    }

    /**
     * @param  array<int, int>  $desiredStaffIds
     */
    private function syncStaffAssignments(
        EventGate $eventGate,
        array $desiredStaffIds,
        bool $canRemoveAssignments,
    ): void {
        $currentStaffIds = $eventGate->staffAssignments()
            ->pluck('user_id')
            ->map(static fn ($id): int => (int) $id)
            ->all();

        foreach (array_diff($desiredStaffIds, $currentStaffIds) as $userId) {
            EventGateStaffAssignment::query()->create([
                'event_gate_id' => $eventGate->getKey(),
                'user_id' => $userId,
            ]);
        }

        if ($canRemoveAssignments) {
            $removedIds = array_diff($currentStaffIds, $desiredStaffIds);
            if ($removedIds !== []) {
                $eventGate->staffAssignments()->whereIn('user_id', $removedIds)->delete();
            }
        }
    }

    /**
     * @param  Collection<int|string, EventGate>  $eventGates
     * @return array<int, array{venue_gate_id: int, capacity: int|null, security_staff_ids: array<int, int>}>
     */
    private function snapshot(Collection $eventGates): array
    {
        return $eventGates
            ->map(static function (EventGate $eventGate): array {
                $staffIds = $eventGate->staffAssignments
                    ->pluck('user_id')
                    ->map(static fn ($id): int => (int) $id)
                    ->sort()
                    ->values()
                    ->all();

                return [
                    'venue_gate_id' => (int) $eventGate->venue_gate_id,
                    'capacity' => $eventGate->capacity === null ? null : (int) $eventGate->capacity,
                    'security_staff_ids' => $staffIds,
                ];
            })
            ->sortBy('venue_gate_id')
            ->values()
            ->all();
    }

    /**
     * @param  array<int, array{capacity: int|null, security_staff_ids: array<int, int>}>  $desired
     * @return array<int, array{venue_gate_id: int, capacity: int|null, security_staff_ids: array<int, int>}>
     */
    private function snapshotDesired(array $desired): array
    {
        $snapshot = [];
        foreach ($desired as $venueGateId => $configuration) {
            $snapshot[] = [
                'venue_gate_id' => (int) $venueGateId,
                'capacity' => $configuration['capacity'],
                'security_staff_ids' => $configuration['security_staff_ids'],
            ];
        }

        return $snapshot;
    }
}
