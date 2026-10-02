import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, CalendarDays, Check, Clock3, DoorOpen, Loader2, Plus, Save, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../services/apiClient';
import type { SecurityStaff } from '../types';

type EventStatus = 'draft' | 'scheduled' | 'in_progress' | 'postponed' | 'cancelled' | 'completed';

interface VenueGateOption {
  id: number;
  code: string;
  name: string;
}

interface VenueOption {
  id: number;
  name: string;
  location_details: string | null;
  gates: VenueGateOption[];
}

interface EventGate {
  id: number;
  venue_gate_id: number;
  code: string | null;
  name: string | null;
  capacity: number | null;
  security_staff: SecurityStaff[];
}

interface AdminEvent {
  id: number;
  venue_id: number;
  venue?: { id: number; name: string };
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: EventStatus;
  configuration_version: number;
  event_gates: EventGate[];
}

interface EventOptionsResponse {
  venues: VenueOption[];
  security_staff: SecurityStaff[];
}

interface EventsResponse {
  events: AdminEvent[];
}

interface EventDraft {
  venueId: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
}

interface GateDraft {
  venueGateId: number;
  capacity: string;
  staffIds: number[];
}

interface AdminEventManagementProps {
  token: string;
}

const STATUS_LABELS: Record<EventStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  completed: 'Completed',
};

const NEXT_STATUSES: Record<EventStatus, EventStatus[]> = {
  draft: ['scheduled', 'cancelled'],
  scheduled: ['in_progress', 'postponed', 'cancelled'],
  in_progress: ['postponed', 'cancelled', 'completed'],
  postponed: ['scheduled', 'cancelled'],
  cancelled: [],
  completed: [],
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function toIsoDateTime(value: string): string {
  return new Date(value).toISOString();
}

function isFinalStatus(status: EventStatus): boolean {
  return status === 'cancelled' || status === 'completed';
}

function statusClass(status: EventStatus): string {
  return 'event-status event-status--' + status;
}

function eventDraftFrom(event: AdminEvent): EventDraft {
  return {
    venueId: String(event.venue_id),
    name: event.name,
    description: event.description ?? '',
    startsAt: toLocalDateTime(event.starts_at),
    endsAt: toLocalDateTime(event.ends_at),
  };
}

export function AdminEventManagement({ token }: AdminEventManagementProps) {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [securityStaff, setSecurityStaff] = useState<SecurityStaff[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [eventDraft, setEventDraft] = useState<EventDraft>({
    venueId: '',
    name: '',
    description: '',
    startsAt: '',
    endsAt: '',
  });
  const [newEventDraft, setNewEventDraft] = useState<EventDraft>({
    venueId: '',
    name: '',
    description: '',
    startsAt: '',
    endsAt: '',
  });
  const [statusDraft, setStatusDraft] = useState<EventStatus>('draft');
  const [eventReason, setEventReason] = useState('');
  const [gateDraft, setGateDraft] = useState<GateDraft[]>([]);
  const [gateReason, setGateReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [isSavingGates, setIsSavingGates] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const selectedVenue = selectedEvent
    ? venues.find((venue) => venue.id === selectedEvent.venue_id)
    : undefined;
  const selectedVenueGates = selectedVenue?.gates ?? [];
  const isSelectedEventFrozen = selectedEvent ? isFinalStatus(selectedEvent.status) : true;
  const startsAtHasChanged = selectedEvent !== null
    && eventDraft.startsAt !== toLocalDateTime(selectedEvent.starts_at);
  const endsAtHasChanged = selectedEvent !== null
    && eventDraft.endsAt !== toLocalDateTime(selectedEvent.ends_at);
  const scheduleHasChanged = startsAtHasChanged || endsAtHasChanged;
  const statusHasChanged = selectedEvent !== null && statusDraft !== selectedEvent.status;
  const eventHasChanged = selectedEvent !== null && (
    eventDraft.name.trim() !== selectedEvent.name
    || (eventDraft.description.trim() || null) !== selectedEvent.description
    || scheduleHasChanged
    || statusHasChanged
  );
  const eventReasonRequired = selectedEvent !== null && (
    (scheduleHasChanged && selectedEvent.status !== 'draft')
    || (statusHasChanged && (statusDraft === 'postponed' || statusDraft === 'cancelled'))
    || (statusHasChanged && selectedEvent.status === 'postponed' && statusDraft === 'scheduled')
  );

  useEffect(() => {
    let isCurrent = true;

    async function loadManagementData(): Promise<void> {
      setIsLoading(true);
      setError(null);

      try {
        const [eventResponse, optionsResponse] = await Promise.all([
          apiRequest<EventsResponse>('/admin/events', { token }),
          apiRequest<EventOptionsResponse>('/admin/event-options', { token }),
        ]);

        if (isCurrent) {
          setEvents(eventResponse.events);
          setVenues(optionsResponse.venues);
          setSecurityStaff(optionsResponse.security_staff);
          setSelectedEventId((current) => current ?? eventResponse.events[0]?.id ?? null);
          setNewEventDraft((current) => ({
            ...current,
            venueId: current.venueId || String(optionsResponse.venues[0]?.id ?? ''),
          }));
        }
      } catch (cause) {
        if (isCurrent) {
          setError(cause instanceof Error ? cause.message : 'Could not load events and gate options.');
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadManagementData();

    return () => {
      isCurrent = false;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedEvent) {
      setGateDraft([]);
      return;
    }

    setEventDraft(eventDraftFrom(selectedEvent));
    setStatusDraft(selectedEvent.status);
    setEventReason('');
    setGateReason('');
    setGateDraft(selectedEvent.event_gates.map((gate) => ({
      venueGateId: gate.venue_gate_id,
      capacity: gate.capacity === null ? '' : String(gate.capacity),
      staffIds: gate.security_staff.map((person) => person.id),
    })));
  }, [selectedEvent?.id, selectedEvent?.configuration_version]);

  async function createEvent(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setIsCreating(true);

    try {
      const created = await apiRequest<AdminEvent>('/admin/events', {
        method: 'POST',
        token,
        body: {
          venue_id: Number(newEventDraft.venueId),
          name: newEventDraft.name.trim(),
          description: newEventDraft.description.trim() || null,
          starts_at: toIsoDateTime(newEventDraft.startsAt),
          ends_at: toIsoDateTime(newEventDraft.endsAt),
        },
      });

      setEvents((current) => [created, ...current]);
      setSelectedEventId(created.id);
      setNewEventDraft({
        venueId: String(venues[0]?.id ?? ''),
        name: '',
        description: '',
        startsAt: '',
        endsAt: '',
      });
      setShowCreateForm(false);
      setNotice('Draft event created. Add gates and assign security staff before scheduling it.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the event.');
    } finally {
      setIsCreating(false);
    }
  }

  async function updateEvent(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedEvent || isSelectedEventFrozen) {
      return;
    }

    setError(null);
    setNotice(null);

    if (eventReasonRequired && !eventReason.trim()) {
      setError('Add a reason for this schedule or status change.');
      return;
    }

    setIsSavingEvent(true);

    try {
      const changes: Record<string, unknown> = {
        reason: eventReason.trim() || null,
      };
      if (eventDraft.name.trim() !== selectedEvent.name) {
        changes.name = eventDraft.name.trim();
      }
      if ((eventDraft.description.trim() || null) !== selectedEvent.description) {
        changes.description = eventDraft.description.trim() || null;
      }
      if (startsAtHasChanged) {
        changes.starts_at = toIsoDateTime(eventDraft.startsAt);
      }
      if (endsAtHasChanged) {
        changes.ends_at = toIsoDateTime(eventDraft.endsAt);
      }
      if (statusHasChanged) {
        changes.status = statusDraft;
      }

      const updated = await apiRequest<AdminEvent>('/admin/events/' + selectedEvent.id, {
        method: 'PATCH',
        token,
        body: changes,
      });

      setEvents((current) => current.map((eventItem) => eventItem.id === updated.id ? updated : eventItem));
      setNotice('Event details saved. This change is recorded in the event change log.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the event.');
    } finally {
      setIsSavingEvent(false);
    }
  }

  async function saveGateAssignments(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedEvent || isSelectedEventFrozen) {
      return;
    }

    setError(null);
    setNotice(null);

    if (selectedEvent.status !== 'draft' && !gateReason.trim()) {
      setError('Add a reason when changing gates or staff on a scheduled event.');
      return;
    }

    setIsSavingGates(true);

    try {
      const gates = gateDraft.map((gate) => ({
        venue_gate_id: gate.venueGateId,
        capacity: gate.capacity.trim() ? Number(gate.capacity) : null,
        security_staff_ids: gate.staffIds,
      }));
      const updated = await apiRequest<AdminEvent>('/admin/events/' + selectedEvent.id + '/gates', {
        method: 'PUT',
        token,
        body: { gates, reason: gateReason.trim() || null },
      });

      setEvents((current) => current.map((eventItem) => eventItem.id === updated.id ? updated : eventItem));
      setNotice('Gate and staff assignments saved. Scanner access follows this event configuration.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save gate assignments.');
    } finally {
      setIsSavingGates(false);
    }
  }

  function toggleGate(gate: VenueGateOption, isChecked: boolean): void {
    setGateDraft((current) => {
      if (isChecked) {
        return [...current, { venueGateId: gate.id, capacity: '', staffIds: [] }];
      }

      return current.filter((item) => item.venueGateId !== gate.id);
    });
  }

  function updateGateDraft(venueGateId: number, update: (gate: GateDraft) => GateDraft): void {
    setGateDraft((current) => current.map((gate) => (
      gate.venueGateId === venueGateId ? update(gate) : gate
    )));
  }

  function toggleStaff(venueGateId: number, staffId: number, isChecked: boolean): void {
    updateGateDraft(venueGateId, (gate) => ({
      ...gate,
      staffIds: isChecked
        ? [...new Set([...gate.staffIds, staffId])]
        : gate.staffIds.filter((id) => id !== staffId),
    }));
  }

  return (
    <section className="event-view" aria-labelledby="events-page-title">
      <header className="dashboard-header event-page-header">
        <div>
          <p className="eyebrow">VENUE OPERATIONS</p>
          <h1 id="events-page-title">Events &amp; gates</h1>
          <p className="dashboard-subtitle">Create an event, select its venue gates, and grant scanner access to staff.</p>
        </div>
        <button className="event-primary-button" type="button" onClick={() => { setShowCreateForm((current) => !current); setError(null); }}>
          <Plus size={17} /> {showCreateForm ? 'Close form' : 'New event'}
        </button>
      </header>

      {error && <div className="notice notice--error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="notice notice--success" role="status"><Check size={18} /><span>{notice}</span></div>}

      {showCreateForm && (
        <section className="surface-card panel event-create-panel" aria-labelledby="create-event-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Event setup</span><h2 id="create-event-title">Create draft event</h2></div>
            <span className="panel-icon"><CalendarDays size={19} /></span>
          </div>
          {venues.length === 0 ? (
            <p className="event-empty-copy">No venues are configured yet. Add venue and gate records before creating an event.</p>
          ) : (
            <form className="event-form event-create-form" onSubmit={(event) => void createEvent(event)}>
              <label htmlFor="new-event-name">Event name</label>
              <input id="new-event-name" maxLength={150} required value={newEventDraft.name}
                onChange={(event) => setNewEventDraft((current) => ({ ...current, name: event.target.value }))} />
              <label htmlFor="new-event-venue">Venue</label>
              <select id="new-event-venue" required value={newEventDraft.venueId}
                onChange={(event) => setNewEventDraft((current) => ({ ...current, venueId: event.target.value }))}>
                {venues.map((venue) => <option value={venue.id} key={venue.id}>{venue.name}</option>)}
              </select>
              <label htmlFor="new-event-starts">Starts</label>
              <input id="new-event-starts" type="datetime-local" required value={newEventDraft.startsAt}
                onChange={(event) => setNewEventDraft((current) => ({ ...current, startsAt: event.target.value }))} />
              <label htmlFor="new-event-ends">Ends</label>
              <input id="new-event-ends" type="datetime-local" required value={newEventDraft.endsAt}
                onChange={(event) => setNewEventDraft((current) => ({ ...current, endsAt: event.target.value }))} />
              <label htmlFor="new-event-description">Description <span>Optional</span></label>
              <textarea id="new-event-description" rows={3} value={newEventDraft.description}
                onChange={(event) => setNewEventDraft((current) => ({ ...current, description: event.target.value }))} />
              <button className="event-primary-button" type="submit" disabled={isCreating}>
                {isCreating ? <><Loader2 size={16} className="spin" /> Creating…</> : <><Plus size={16} /> Create draft</>}
              </button>
            </form>
          )}
        </section>
      )}

      <div className="events-layout">
        <section className="surface-card panel event-list-panel" aria-labelledby="event-list-title">
          <div className="panel-heading">
            <div><span className="eyebrow">Planning &amp; live events</span><h2 id="event-list-title">Event list</h2></div>
            <span className="count-pill count-pill--amber">{events.length} events</span>
          </div>
          {isLoading ? (
            <div className="event-empty-copy"><Loader2 size={18} className="spin" /> Loading events…</div>
          ) : events.length > 0 ? (
            <ul className="event-list">
              {events.map((eventItem) => (
                <li key={eventItem.id}>
                  <button className={eventItem.id === selectedEventId ? 'event-list-item event-list-item--selected' : 'event-list-item'}
                    type="button" onClick={() => { setSelectedEventId(eventItem.id); setError(null); setNotice(null); }}>
                    <span className="event-list-item__top"><strong>{eventItem.name}</strong><span className={statusClass(eventItem.status)}>{STATUS_LABELS[eventItem.status]}</span></span>
                    <span className="event-list-item__venue">{eventItem.venue?.name ?? 'Venue unavailable'}</span>
                    <span className="event-list-item__date"><Clock3 size={13} />{formatDate(eventItem.starts_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="event-empty-state">
              <span className="staff-empty-icon"><CalendarDays size={21} /></span>
              <strong>No events yet</strong>
              <p>Create a draft event to start configuring gates and scanner staff.</p>
            </div>
          )}
        </section>

        {selectedEvent ? (
          <div className="event-detail">
            <section className="surface-card panel event-details-panel" aria-labelledby="event-detail-title">
              <div className="panel-heading">
                <div><span className="eyebrow">Event #{selectedEvent.id} · Configuration v{selectedEvent.configuration_version}</span><h2 id="event-detail-title">{selectedEvent.name}</h2></div>
                <span className={statusClass(selectedEvent.status)}>{STATUS_LABELS[selectedEvent.status]}</span>
              </div>
              <form className="event-form event-edit-form" onSubmit={(event) => void updateEvent(event)}>
                <label htmlFor="event-name">Event name</label>
                <input id="event-name" maxLength={150} required disabled={isSelectedEventFrozen} value={eventDraft.name}
                  onChange={(event) => setEventDraft((current) => ({ ...current, name: event.target.value }))} />
                <label htmlFor="event-status">Status</label>
                <select id="event-status" disabled={isSelectedEventFrozen} value={statusDraft}
                  onChange={(event) => setStatusDraft(event.target.value as EventStatus)}>
                  <option value={selectedEvent.status}>{STATUS_LABELS[selectedEvent.status]}</option>
                  {NEXT_STATUSES[selectedEvent.status].map((status) => <option value={status} key={status}>{STATUS_LABELS[status]}</option>)}
                </select>
                <label htmlFor="event-starts">Starts</label>
                <input id="event-starts" type="datetime-local" required disabled={isSelectedEventFrozen} value={eventDraft.startsAt}
                  onChange={(event) => setEventDraft((current) => ({ ...current, startsAt: event.target.value }))} />
                <label htmlFor="event-ends">Ends</label>
                <input id="event-ends" type="datetime-local" required disabled={isSelectedEventFrozen} value={eventDraft.endsAt}
                  onChange={(event) => setEventDraft((current) => ({ ...current, endsAt: event.target.value }))} />
                <label htmlFor="event-description">Description <span>Optional</span></label>
                <textarea id="event-description" rows={3} disabled={isSelectedEventFrozen} value={eventDraft.description}
                  onChange={(event) => setEventDraft((current) => ({ ...current, description: event.target.value }))} />
                <label htmlFor="event-reason">Change reason {eventReasonRequired ? <span>(required)</span> : <span>(required for rescheduling, postponing, or cancelling)</span>}</label>
                <textarea id="event-reason" rows={2} maxLength={1000} required={eventReasonRequired} disabled={isSelectedEventFrozen}
                  value={eventReason} onChange={(event) => setEventReason(event.target.value)} />
                {isSelectedEventFrozen ? (
                  <p className="event-locked-note">This event is final. Its schedule and scanner assignments are locked.</p>
                ) : (
                  <button className="event-primary-button" type="submit" disabled={isSavingEvent || !eventHasChanged}>
                    {isSavingEvent ? <><Loader2 size={16} className="spin" /> Saving…</> : <><Save size={16} /> Save event changes</>}
                  </button>
                )}
              </form>
              <div className="event-summary">
                <span><DoorOpen size={15} />{selectedEvent.venue?.name ?? 'Venue unavailable'}</span>
                <span><Clock3 size={15} />{formatDate(selectedEvent.starts_at)} – {formatDate(selectedEvent.ends_at)}</span>
              </div>
            </section>

            <section className="surface-card panel gate-assignments-panel" aria-labelledby="gate-assignments-title">
              <div className="panel-heading">
                <div><span className="eyebrow">Door access</span><h2 id="gate-assignments-title">Gate assignments</h2></div>
                <span className="panel-icon"><ShieldCheck size={19} /></span>
              </div>
              {!selectedVenue ? (
                <p className="event-empty-copy">Venue details are unavailable for this event.</p>
              ) : selectedVenueGates.length === 0 ? (
                <p className="event-empty-copy">This venue has no gates configured. Add venue gates before assigning scanner access.</p>
              ) : (
                <form className="gate-assignment-form" onSubmit={(event) => void saveGateAssignments(event)}>
                  {selectedEvent.status !== 'draft' && !isSelectedEventFrozen && (
                    <p className="event-policy-note">Scheduled event access is protected for offline scanners. Existing gates and staff cannot be removed; additions require a reason.</p>
                  )}
                  <div className="gate-option-list">
                    {selectedVenueGates.map((venueGate) => {
                      const draft = gateDraft.find((gate) => gate.venueGateId === venueGate.id);
                      const existingGate = selectedEvent.event_gates.find((gate) => gate.venue_gate_id === venueGate.id);
                      const existingStaffIds = existingGate?.security_staff.map((person) => person.id) ?? [];
                      const canRemoveGate = selectedEvent.status === 'draft' || !existingGate;
                      return (
                        <fieldset className={draft ? 'gate-option gate-option--selected' : 'gate-option'} key={venueGate.id}>
                          <legend className="visually-hidden">{venueGate.code} {venueGate.name}</legend>
                          <label className="gate-toggle">
                            <input type="checkbox" checked={Boolean(draft)} disabled={isSelectedEventFrozen || (!canRemoveGate && Boolean(draft))}
                              onChange={(event) => toggleGate(venueGate, event.target.checked)} />
                            <span className="gate-toggle-copy"><strong>{venueGate.code}</strong><span>{venueGate.name}</span></span>
                            {existingGate && <span className="gate-existing-tag">Configured</span>}
                          </label>
                          {draft && (
                            <div className="gate-option-content">
                              <label className="capacity-label" htmlFor={'gate-capacity-' + venueGate.id}>Ticket capacity <span>Optional</span></label>
                              <input id={'gate-capacity-' + venueGate.id} type="number" min={1} step={1} inputMode="numeric"
                                disabled={isSelectedEventFrozen} value={draft.capacity}
                                onChange={(event) => updateGateDraft(venueGate.id, (current) => ({ ...current, capacity: event.target.value }))} />
                              <span className="staff-select-label">Assign scanner staff</span>
                              {securityStaff.length === 0 ? (
                                <p className="event-empty-copy">Create a Security Staff account first.</p>
                              ) : (
                                <div className="staff-checkbox-list">
                                  {securityStaff.map((person) => {
                                    const isAlreadyAssigned = existingStaffIds.includes(person.id);
                                    return (
                                      <label className="staff-checkbox" key={person.id}>
                                        <input type="checkbox" checked={draft.staffIds.includes(person.id)}
                                          disabled={isSelectedEventFrozen || (selectedEvent.status !== 'draft' && isAlreadyAssigned)}
                                          onChange={(event) => toggleStaff(venueGate.id, person.id, event.target.checked)} />
                                        <span><strong>{person.name}</strong><small>{person.email}</small></span>
                                        {isAlreadyAssigned && selectedEvent.status !== 'draft' && <small className="staff-locked-tag">Already assigned</small>}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </fieldset>
                      );
                    })}
                  </div>
                  {selectedEvent.status !== 'draft' && !isSelectedEventFrozen && (
                    <label className="gate-reason-field" htmlFor="gate-reason">Reason for access change <span>(required)</span>
                      <textarea id="gate-reason" rows={2} maxLength={1000} required value={gateReason}
                        onChange={(event) => setGateReason(event.target.value)} />
                    </label>
                  )}
                  {!isSelectedEventFrozen && (
                    <button className="event-primary-button" type="submit" disabled={isSavingGates}>
                      {isSavingGates ? <><Loader2 size={16} className="spin" /> Saving…</> : <><Save size={16} /> Save gate assignments</>}
                    </button>
                  )}
                </form>
              )}
            </section>
          </div>
        ) : (
          <section className="surface-card event-no-selection">
            <span className="staff-empty-icon"><CalendarDays size={21} /></span>
            <strong>{isLoading ? 'Loading event details' : 'Select an event'}</strong>
            <p>{isLoading ? 'The event list is being fetched.' : 'Choose an event or create one to configure its schedule and gates.'}</p>
          </section>
        )}
      </div>
    </section>
  );
}
