<?php

namespace App\Services;

use App\Models\Event;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AdminEventTicketRevocationService
{
    public function __construct(private readonly AdminEventManagementService $eventManagementService) {}

    public function listForEvent(Event $event): LengthAwarePaginator
    {
        return Ticket::query()
            ->whereHas('eventGate', static function (Builder $query) use ($event): void {
                $query->where('event_id', $event->getKey());
            })
            ->with([
                'user:id,name,student_number',
                'eventGate.venueGate',
            ])
            ->orderBy('id')
            ->paginate(50);
    }

    public function revoke(Event $event, int $ticketId, string $reason, User $actor): Ticket
    {
        $reason = trim($reason);

        if ($reason === '') {
            throw ValidationException::withMessages([
                'reason' => 'Provide a reason for revoking this ticket.',
            ]);
        }

        return DB::transaction(function () use ($event, $ticketId, $reason, $actor): Ticket {
            $lockedEvent = Event::query()
                ->whereKey($event->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            $ticket = Ticket::query()
                ->whereKey($ticketId)
                ->whereHas('eventGate', static function (Builder $query) use ($lockedEvent): void {
                    $query->where('event_id', $lockedEvent->getKey());
                })
                ->lockForUpdate()
                ->firstOrFail();

            if (! in_array($ticket->status, [Ticket::STATUS_ISSUED, Ticket::STATUS_CLAIMED], true)) {
                throw ValidationException::withMessages([
                    'ticket' => 'Only an issued or claimed ticket can be revoked.',
                ]);
            }

            $oldValues = [
                'ticket_id' => $ticket->getKey(),
                'status' => $ticket->status,
            ];

            $ticket->status = Ticket::STATUS_REVOKED;
            $ticket->save();

            $lockedEvent->configuration_version++;
            $lockedEvent->save();

            $this->eventManagementService->recordChange(
                $lockedEvent,
                $actor,
                'ticket_revoked',
                $reason,
                $oldValues,
                [
                    'ticket_id' => $ticket->getKey(),
                    'event_gate_id' => $ticket->event_gate_id,
                    'status' => Ticket::STATUS_REVOKED,
                ],
            );

            return $ticket->load([
                'user:id,name,student_number',
                'eventGate.venueGate',
            ]);
        }, 3);
    }
}
