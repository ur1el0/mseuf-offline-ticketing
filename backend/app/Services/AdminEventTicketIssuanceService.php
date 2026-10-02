<?php

namespace App\Services;

use App\Models\Event;
use App\Models\EventGate;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminEventTicketIssuanceService
{
    public function __construct(private readonly AdminEventManagementService $eventManagementService) {}

    public function issue(Event $event, int $eventGateId, string $studentNumber, User $actor): Ticket
    {
        return DB::transaction(function () use ($event, $eventGateId, $studentNumber, $actor): Ticket {
            $lockedEvent = Event::query()
                ->whereKey($event->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if (in_array($lockedEvent->status, [Event::STATUS_CANCELLED, Event::STATUS_COMPLETED], true)) {
                throw ValidationException::withMessages([
                    'event' => 'Tickets cannot be issued for cancelled or completed events.',
                ]);
            }

            $eventGate = EventGate::query()
                ->whereKey($eventGateId)
                ->where('event_id', $lockedEvent->getKey())
                ->lockForUpdate()
                ->first();

            if (! $eventGate instanceof EventGate) {
                throw ValidationException::withMessages([
                    'event_gate_id' => 'Choose a gate assigned to this event.',
                ]);
            }

            $student = User::query()
                ->where('student_number', $studentNumber)
                ->where('role', User::ROLE_STUDENT)
                ->lockForUpdate()
                ->first();

            if (! $student instanceof User) {
                throw ValidationException::withMessages([
                    'student_number' => 'No student account matches this student number.',
                ]);
            }

            $ticket = Ticket::query()
                ->where('user_id', $student->getKey())
                ->where('event_gate_id', $eventGate->getKey())
                ->lockForUpdate()
                ->first();

            if ($ticket instanceof Ticket && $ticket->status !== Ticket::STATUS_REVOKED) {
                throw ValidationException::withMessages([
                    'student_number' => 'This student already has a ticket for the selected gate.',
                ]);
            }

            $activeTicketCount = $eventGate->tickets()
                ->whereIn('status', [Ticket::STATUS_ISSUED, Ticket::STATUS_CLAIMED])
                ->count();

            if ($eventGate->capacity !== null && $activeTicketCount >= $eventGate->capacity) {
                throw ValidationException::withMessages([
                    'event_gate_id' => 'This gate has reached its ticket capacity.',
                ]);
            }

            $oldValues = $ticket instanceof Ticket
                ? ['ticket_id' => $ticket->getKey(), 'status' => $ticket->status]
                : null;

            if ($ticket instanceof Ticket) {
                $ticket->fill([
                    'totp_secret' => bin2hex(random_bytes(20)),
                    'status' => Ticket::STATUS_ISSUED,
                ]);
                $ticket->save();
            } else {
                $ticket = Ticket::query()->create([
                    'user_id' => $student->getKey(),
                    'event_gate_id' => $eventGate->getKey(),
                    'totp_secret' => bin2hex(random_bytes(20)),
                    'status' => Ticket::STATUS_ISSUED,
                ]);
            }

            $lockedEvent->configuration_version++;
            $lockedEvent->save();

            $this->eventManagementService->recordChange(
                $lockedEvent,
                $actor,
                'ticket_issued',
                null,
                $oldValues,
                [
                    'ticket_id' => $ticket->getKey(),
                    'event_gate_id' => $eventGate->getKey(),
                    'status' => Ticket::STATUS_ISSUED,
                ],
            );

            return $ticket;
        }, 3);
    }
}
