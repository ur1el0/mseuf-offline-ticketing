import { useEffect, useState, type FormEvent } from 'react';
import { Activity, AlertCircle, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { apiRequest } from '../services/apiClient';

type ActivityType = 'all' | 'account' | 'event_change' | 'scan' | 'anomaly';

interface ActivityEntry {
  id: string;
  type: Exclude<ActivityType, 'all'>;
  event: { id: number; name: string } | null;
  actor: { id: number; name: string } | null;
  subject: string;
  action: string;
  outcome: string;
  detail: string | null;
  occurred_at: string;
}

interface ActivityResponse {
  entries: ActivityEntry[];
  has_more: boolean;
  limit: number;
}

interface EventOption {
  id: number;
  name: string;
}

interface EventListResponse {
  events: EventOption[];
}

interface ActivityLogManagementProps {
  token: string;
}

const typeLabels: Record<ActivityType, string> = {
  all: 'All activity',
  account: 'Account creation',
  event_change: 'Event changes',
  scan: 'Ticket scans',
  anomaly: 'Security anomalies',
};

function humanize(value: string): string {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatOccurredAt(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function outcomeLabel(value: string): string {
  if (value === 'review_required') return 'Review';
  if (value === 'recorded') return 'Recorded';
  return humanize(value);
}

export function ActivityLogManagement({ token }: ActivityLogManagementProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [type, setType] = useState<ActivityType>('all');
  const [eventId, setEventId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    let isCurrent = true;

    async function loadEvents(): Promise<void> {
      try {
        const result = await apiRequest<EventListResponse>('/admin/events', { token });
        if (isCurrent) setEvents(result.events.map(({ id, name }) => ({ id, name })));
      } catch (cause) {
        if (isCurrent) setEventError(cause instanceof Error ? cause.message : 'Could not load event filters.');
      }
    }

    void loadEvents();
    return () => { isCurrent = false; };
  }, [token]);

  async function loadActivity(filters: { type: ActivityType; eventId: string; from: string; to: string }): Promise<void> {
    setIsLoading(true);
    setError(null);
    const query = new URLSearchParams({ type: filters.type, limit: '100' });
    if (filters.eventId) query.set('event_id', filters.eventId);
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', filters.to);

    try {
      const result = await apiRequest<ActivityResponse>('/admin/activity-logs?' + query.toString(), { token });
      setEntries(result.entries);
      setHasMore(result.has_more);
      setLimit(result.limit);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load activity logs.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadActivity({ type, eventId, from, to });
    // Filter changes trigger a fresh request so the list always reflects the visible controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, type, eventId, from, to]);

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (from && to && to < from) {
      setError('The end date must be the same as or later than the start date.');
      return;
    }
    void loadActivity({ type, eventId, from, to });
  }

  return (
    <section className="activity-log-view" aria-labelledby="activity-log-title">
      <header className="dashboard-header staff-page-header">
        <div>
          <p className="eyebrow">SYSTEM HISTORY</p>
          <h1 id="activity-log-title">Audit log</h1>
          <p className="dashboard-subtitle">Review account setup, event changes, ticket scans, and security anomalies.</p>
        </div>
        <button className="event-primary-button activity-refresh" type="button"
          onClick={() => void loadActivity({ type, eventId, from, to })} disabled={isLoading}>
          <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> Refresh
        </button>
      </header>

      {error && <div className="notice notice--error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {eventError && <div className="notice notice--stale" role="status"><AlertCircle size={18} /><span>{eventError} Event filtering is unavailable.</span></div>}

      <section className="surface-card panel activity-filter-panel" aria-label="Activity filters">
        <div className="panel-heading">
          <div><span className="eyebrow">Filter records</span><h2>Choose what to review</h2></div>
          <span className="panel-icon"><ClipboardList size={19} /></span>
        </div>
        <form className="activity-filter-form" onSubmit={applyFilters}>
          <label>
            <span>Activity type</span>
            <select value={type} onChange={(event) => setType(event.target.value as ActivityType)}>
              {(Object.keys(typeLabels) as ActivityType[]).map((value) => <option key={value} value={value}>{typeLabels[value]}</option>)}
            </select>
          </label>
          <label>
            <span>Event</span>
            <select value={eventId} onChange={(event) => setEventId(event.target.value)}>
              <option value="">All events</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
            </select>
          </label>
          <label>
            <span>From date</span>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label>
            <span>To date</span>
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <button className="event-primary-button activity-filter-button" type="submit" disabled={isLoading}>
            {isLoading ? <><Loader2 size={16} className="spin" /> Loading…</> : <><Activity size={16} /> Apply filters</>}
          </button>
        </form>
      </section>

      <section className="surface-card panel activity-results-panel" aria-labelledby="activity-results-title">
        <div className="panel-heading">
          <div><span className="eyebrow">Newest first</span><h2 id="activity-results-title">System activity</h2></div>
          <span className="count-pill count-pill--amber">{entries.length}{hasMore ? '+' : ''} records</span>
        </div>

        {isLoading ? (
          <div className="staff-loading" role="status"><Loader2 size={20} className="spin" /> Loading activity…</div>
        ) : entries.length > 0 ? (
          <>
            <ol className="audit-entry-list">
              {entries.map((entry) => (
                <li className="audit-entry" key={entry.id}>
                  <span className={'audit-entry-icon audit-entry-icon--' + entry.type}><ClipboardList size={17} /></span>
                  <div className="audit-entry-copy">
                    <div className="audit-entry-heading">
                      <strong>{humanize(entry.action)}</strong>
                      <span className={'audit-outcome audit-outcome--' + entry.outcome}>{outcomeLabel(entry.outcome)}</span>
                    </div>
                    <p>{entry.subject}</p>
                    <div className="audit-entry-context">
                      <span>{entry.event?.name ?? 'Account management'}</span>
                      <span>{entry.actor?.name ?? 'Unknown actor'}</span>
                    </div>
                    {entry.detail ? <small className="audit-entry-detail">{humanize(entry.detail)}</small> : null}
                  </div>
                  <time dateTime={entry.occurred_at}>{formatOccurredAt(entry.occurred_at)}</time>
                </li>
              ))}
            </ol>
            {hasMore ? <p className="activity-limit-note">Showing the newest {limit} matches. Older records can be added with pagination in a later slice.</p> : null}
          </>
        ) : (
          <div className="staff-empty-state">
            <span className="staff-empty-icon"><Activity size={21} /></span>
            <strong>No matching activity</strong>
            <p>Try another activity type, event, or date range.</p>
          </div>
        )}
      </section>
    </section>
  );
}
