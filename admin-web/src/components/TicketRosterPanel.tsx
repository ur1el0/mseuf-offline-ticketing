import { useEffect, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Loader2, ShieldOff, TicketCheck, X } from 'lucide-react';
import { apiRequest } from '../services/apiClient';

type TicketStatus = 'issued' | 'claimed' | 'revoked';

interface EventTicket {
  id: number;
  student: {
    id: number;
    name: string;
    student_number: string | null;
  };
  gate: {
    event_gate_id: number;
    code: string;
    name: string;
  };
  status: TicketStatus;
}

interface TicketPageResponse {
  data: EventTicket[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
  };
}

interface RevokeTicketResponse {
  configuration_version: number;
  ticket: EventTicket;
}

interface TicketRosterPanelProps {
  eventId: number;
  configurationVersion: number;
  token: string;
  onTicketRevoked: (eventGateId: number, configurationVersion: number) => void;
}

function ticketStatusLabel(status: TicketStatus): string {
  switch (status) {
    case 'issued':
      return 'Issued';
    case 'claimed':
      return 'Claimed';
    case 'revoked':
      return 'Revoked';
  }
}

export function TicketRosterPanel({
  eventId,
  configurationVersion,
  token,
  onTicketRevoked,
}: TicketRosterPanelProps) {
  const [tickets, setTickets] = useState<EventTicket[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [revokingTicketId, setRevokingTicketId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let isCurrent = true;

    async function loadTickets(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiRequest<TicketPageResponse>(
          `/admin/events/${eventId}/tickets?page=${page}`,
          { token },
        );

        if (!isCurrent) {
          return;
        }

        if (page > response.meta.last_page && response.meta.last_page > 0) {
          setPage(response.meta.last_page);
          return;
        }

        setTickets(response.data);
        setLastPage(response.meta.last_page);
        setTotal(response.meta.total);
      } catch (cause) {
        if (isCurrent) {
          setError(cause instanceof Error ? cause.message : 'Could not load event tickets.');
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadTickets();

    return () => {
      isCurrent = false;
    };
  }, [configurationVersion, eventId, page, token]);

  async function revokeTicket(event: FormEvent<HTMLFormElement>, ticket: EventTicket): Promise<void> {
    event.preventDefault();

    if (!reason.trim()) {
      setError('Enter a reason before revoking this ticket.');
      return;
    }

    setError(null);
    setNotice(null);
    setIsRevoking(true);

    try {
      const response = await apiRequest<RevokeTicketResponse>(
        `/admin/events/${eventId}/tickets/${ticket.id}/revoke`,
        {
          method: 'PATCH',
          token,
          body: { reason: reason.trim() },
        },
      );

      setTickets((current) => current.map((item) => (
        item.id === response.ticket.id ? response.ticket : item
      )));
      setRevokingTicketId(null);
      setReason('');
      setNotice(`Ticket #${ticket.id} revoked. Offline scanners may continue to accept an older cached pass until they reconnect and refresh.`);
      onTicketRevoked(response.ticket.gate.event_gate_id, response.configuration_version);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not revoke this ticket.');
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <section className="surface-card panel ticket-roster-panel" aria-labelledby="ticket-roster-title">
      <div className="panel-heading">
        <div><span className="eyebrow">Student access</span><h2 id="ticket-roster-title">Ticket roster</h2></div>
        <span className="count-pill count-pill--amber">{total} tickets</span>
      </div>

      <p className="ticket-roster-warning">
        <ShieldOff size={15} />
        A scanner already offline with a cached pass cannot receive this revocation until it reconnects.
      </p>

      {error && <p className="ticket-roster-message ticket-roster-message--error" role="alert">{error}</p>}
      {notice && <p className="ticket-roster-message ticket-roster-message--success" role="status">{notice}</p>}

      {isLoading ? (
        <div className="event-empty-copy"><Loader2 size={16} className="spin" /> Loading tickets…</div>
      ) : tickets.length === 0 ? (
        <div className="event-empty-state">
          <span className="staff-empty-icon"><TicketCheck size={19} /></span>
          <strong>No tickets issued</strong>
          <p>Tickets issued to students for this event will appear here.</p>
        </div>
      ) : (
        <>
          <ul className="ticket-roster-list">
            {tickets.map((ticket) => (
              <li className="ticket-roster-item" key={ticket.id}>
                <div className="ticket-roster-identity">
                  <strong>{ticket.student.name}</strong>
                  <span>{ticket.student.student_number ?? 'No student number'}</span>
                  <span>{ticket.gate.code} · {ticket.gate.name}</span>
                </div>
                <span className={`event-status event-status--${ticket.status}`}>
                  {ticketStatusLabel(ticket.status)}
                </span>
                {ticket.status !== 'revoked' && revokingTicketId !== ticket.id && (
                  <button className="ticket-roster-action" type="button"
                    onClick={() => { setRevokingTicketId(ticket.id); setReason(''); setError(null); }}>
                    Revoke
                  </button>
                )}
                {revokingTicketId === ticket.id && (
                  <form className="ticket-roster-revoke-form" onSubmit={(event) => void revokeTicket(event, ticket)}>
                    <label htmlFor={`ticket-revoke-reason-${ticket.id}`}>Reason for revocation</label>
                    <textarea id={`ticket-revoke-reason-${ticket.id}`} rows={2} maxLength={1000} required
                      value={reason} onChange={(event) => setReason(event.target.value)} />
                    <div>
                      <button className="ticket-roster-action ticket-roster-action--danger" type="submit"
                        disabled={isRevoking || !reason.trim()}>
                        {isRevoking ? <><Loader2 size={14} className="spin" /> Revoking…</> : <><ShieldOff size={14} /> Revoke ticket</>}
                      </button>
                      <button className="ticket-roster-cancel" type="button" disabled={isRevoking}
                        onClick={() => { setRevokingTicketId(null); setReason(''); }}>
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>

          {lastPage > 1 && (
            <div className="ticket-roster-pagination">
              <span>Page {page} of {lastPage}</span>
              <div>
                <button type="button" aria-label="Previous ticket page" disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  <ChevronLeft size={15} />
                </button>
                <button type="button" aria-label="Next ticket page" disabled={page >= lastPage}
                  onClick={() => setPage((current) => Math.min(lastPage, current + 1))}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
