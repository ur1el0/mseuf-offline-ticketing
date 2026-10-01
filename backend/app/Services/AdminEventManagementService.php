<?php

namespace App\Services;

use App\Models\Event;
use App\Models\EventChangeLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminEventManagementService
{
    /**
     * @return Collection<int, Event>
     */
    public function listEvents(): Collection
    {
        return Event::query()
            ->with(['venue', 'eventGates.venueGate', 'eventGates.staffAssignments.user'])
            ->orderByDesc('starts_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get();
    }

    public function loadEvent(Event $event): Event
    {
        return Event::query()
            ->with(['venue', 'eventGates.venueGate', 'eventGates.staffAssignments.user'])
            ->findOrFail($event->getKey());
    }

    /**
     * @param  array{venue_id: int|string, name: string, description?: string|null, starts_at: string, ends_at: string}  $attributes
     */
    public function createEvent(array $attributes, User $actor): Event
    {
        return DB::transaction(function () use ($attributes, $actor): Event {
            $event = Event::query()->create([
                'venue_id' => (int) $attributes['venue_id'],
                'name' => $attributes['name'],
                'description' => $attributes['description'] ?? null,
                'starts_at' => CarbonImmutable::parse($attributes['starts_at']),
                'ends_at' => CarbonImmutable::parse($attributes['ends_at']),
                'status' => Event::STATUS_DRAFT,
                'configuration_version' => 1,
            ]);

            $this->recordChange(
                $event,
                $actor,
                'event_created',
                null,
                null,
                $this->eventSnapshot($event),
            );

            return $this->loadEvent($event);
        }, 3);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function updateEvent(Event $event, array $attributes, User $actor): Event
    {
        $reason = $this->cleanReason($attributes['reason'] ?? null);
        unset($attributes['reason']);

        return DB::transaction(function () use ($event, $attributes, $actor, $reason): Event {
            $lockedEvent = Event::query()
                ->whereKey($event->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $this->ensureEditable($lockedEvent);
            $submittedChanges = array_intersect_key($attributes, array_flip([
                'name',
                'description',
                'starts_at',
                'ends_at',
                'status',
            ]));

            if ($submittedChanges === []) {
                throw ValidationException::withMessages([
                    'event' => 'Provide at least one event field to update.',
                ]);
            }

            $startsAt = array_key_exists('starts_at', $submittedChanges)
                ? CarbonImmutable::parse($submittedChanges['starts_at'])
                : $lockedEvent->starts_at;
            $endsAt = array_key_exists('ends_at', $submittedChanges)
                ? CarbonImmutable::parse($submittedChanges['ends_at'])
                : $lockedEvent->ends_at;

            if ($endsAt->lessThanOrEqualTo($startsAt)) {
                throw ValidationException::withMessages([
                    'ends_at' => 'The event end must be after its start.',
                ]);
            }

            $changes = [];
            foreach ($submittedChanges as $field => $value) {
                if ($field === 'starts_at') {
                    if (! $startsAt->equalTo($lockedEvent->starts_at)) {
                        $changes[$field] = $startsAt;
                    }
                } elseif ($field === 'ends_at') {
                    if (! $endsAt->equalTo($lockedEvent->ends_at)) {
                        $changes[$field] = $endsAt;
                    }
                } elseif ($value !== $lockedEvent->{$field}) {
                    $changes[$field] = $value;
                }
            }

            if ($changes === []) {
                return $this->loadEvent($lockedEvent);
            }

            $scheduleChanged = array_key_exists('starts_at', $changes)
                || array_key_exists('ends_at', $changes);
            $nextStatus = $changes['status'] ?? $lockedEvent->status;
            $statusChanged = $nextStatus !== $lockedEvent->status;

            if ($statusChanged) {
                $this->ensureTransitionAllowed($lockedEvent->status, $nextStatus);
            }

            $reasonRequired = ($scheduleChanged && $lockedEvent->status !== Event::STATUS_DRAFT)
                || ($statusChanged && in_array($nextStatus, [
                    Event::STATUS_POSTPONED,
                    Event::STATUS_CANCELLED,
                ], true))
                || ($statusChanged
                    && $lockedEvent->status === Event::STATUS_POSTPONED
                    && $nextStatus === Event::STATUS_SCHEDULED);

            if ($reasonRequired && $reason === null) {
                throw ValidationException::withMessages([
                    'reason' => 'Provide a reason for rescheduling, postponing, or cancelling this event.',
                ]);
            }

            $oldValues = $this->eventSnapshot($lockedEvent);
            $lockedEvent->fill($changes);
            $lockedEvent->configuration_version++;
            $lockedEvent->save();

            $changeType = $scheduleChanged
                ? 'schedule_changed'
                : ($statusChanged ? 'status_changed' : 'details_updated');

            $this->recordChange(
                $lockedEvent,
                $actor,
                $changeType,
                $reason,
                $oldValues,
                $this->eventSnapshot($lockedEvent),
            );

            return $this->loadEvent($lockedEvent);
        }, 3);
    }

    /**
     * @return array<string, mixed>
     */
    public function eventSnapshot(Event $event): array
    {
        return [
            'venue_id' => $event->venue_id,
            'name' => $event->name,
            'description' => $event->description,
            'starts_at' => $event->starts_at?->toIso8601String(),
            'ends_at' => $event->ends_at?->toIso8601String(),
            'status' => $event->status,
        ];
    }

    /**
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>  $newValues
     */
    public function recordChange(
        Event $event,
        User $actor,
        string $changeType,
        ?string $reason,
        ?array $oldValues,
        array $newValues,
    ): void {
        EventChangeLog::query()->create([
            'event_id' => $event->getKey(),
            'actor_user_id' => $actor->getKey(),
            'configuration_version' => $event->configuration_version,
            'change_type' => $changeType,
            'reason' => $reason,
            'old_values' => $oldValues,
            'new_values' => $newValues,
        ]);
    }

    public function cleanReason(mixed $reason): ?string
    {
        if (! is_string($reason)) {
            return null;
        }

        $reason = trim($reason);

        return $reason === '' ? null : $reason;
    }

    private function ensureEditable(Event $event): void
    {
        if (in_array($event->status, [Event::STATUS_CANCELLED, Event::STATUS_COMPLETED], true)) {
            throw ValidationException::withMessages([
                'status' => 'Cancelled and completed events cannot be changed.',
            ]);
        }
    }

    private function ensureTransitionAllowed(string $currentStatus, string $nextStatus): void
    {
        $transitions = [
            Event::STATUS_DRAFT => [Event::STATUS_SCHEDULED, Event::STATUS_CANCELLED],
            Event::STATUS_SCHEDULED => [
                Event::STATUS_IN_PROGRESS,
                Event::STATUS_POSTPONED,
                Event::STATUS_CANCELLED,
            ],
            Event::STATUS_IN_PROGRESS => [
                Event::STATUS_POSTPONED,
                Event::STATUS_CANCELLED,
                Event::STATUS_COMPLETED,
            ],
            Event::STATUS_POSTPONED => [Event::STATUS_SCHEDULED, Event::STATUS_CANCELLED],
            Event::STATUS_CANCELLED => [],
            Event::STATUS_COMPLETED => [],
        ];

        if (! in_array($nextStatus, $transitions[$currentStatus] ?? [], true)) {
            throw ValidationException::withMessages([
                'status' => "The event cannot move from {$currentStatus} to {$nextStatus}.",
            ]);
        }
    }
}
