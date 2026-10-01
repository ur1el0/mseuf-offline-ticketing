import { useState, type CSSProperties } from 'react';
import {
  Activity, AlertCircle, CalendarDays, CheckCheck, ChevronDown,
  ClipboardList, DoorOpen, LogOut, RefreshCw, ShieldCheck, TicketCheck,
} from 'lucide-react';
import { useAdminMetrics } from '../hooks/useAdminMetrics';
import type { AuthSession } from '../types';
import { GateThroughputPanel } from './GateThroughputPanel';
import { MetricCard } from './MetricCard';
import { OperationalPanels } from './OperationalPanels';
import { SecurityStaffManagement } from './SecurityStaffManagement';

const number = new Intl.NumberFormat();

interface AdminDashboardProps {
  session: AuthSession;
  onSignOut: () => Promise<void>;
  isSigningOut: boolean;
}

function formatTime(value: Date | null): string {
  return value ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(value) : 'Waiting for first update';
}

export function AdminDashboard({ session, onSignOut, isSigningOut }: AdminDashboardProps) {
  const { data, error, isLoading, updatedAt, refresh } = useAdminMetrics(session.token);
  const [activeView, setActiveView] = useState<'dashboard' | 'staff'>('dashboard');
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const admittedPercent = data && data.total_issued > 0
    ? Math.round((data.total_admitted / data.total_issued) * 100)
    : 0;

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await onSignOut();
    } catch (cause) {
      setSignOutError(cause instanceof Error ? cause.message : 'Unable to sign out. Check the connection and try again.');
    }
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="#dashboard" aria-label="EUEvent dashboard">
          <img src="/brand/euevent-192.png" alt="" />
          <span>EU<span>Event</span><small>ADMIN PORTAL</small></span>
        </a>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Administrator navigation">
          <button className={activeView === 'dashboard' ? 'nav-item nav-item--active' : 'nav-item'} type="button"
            onClick={() => setActiveView('dashboard')} aria-current={activeView === 'dashboard' ? 'page' : undefined}>
            <Activity size={19} /><span>Live dashboard</span>
          </button>
          <button className={activeView === 'staff' ? 'nav-item nav-item--active' : 'nav-item'} type="button"
            onClick={() => setActiveView('staff')} aria-current={activeView === 'staff' ? 'page' : undefined}>
            <ShieldCheck size={19} /><span>Security staff</span>
          </button>
          <button className="nav-item nav-item--disabled" type="button" disabled title="Event setup and gate assignments are the next management module">
            <CalendarDays size={19} /><span>Events &amp; gates</span><small>Next</small>
          </button>
          <button className="nav-item nav-item--disabled" type="button" disabled title="Full audit-log browsing is the next management module">
            <ClipboardList size={19} /><span>Audit log</span><small>Next</small>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className={`status-dot ${error ? 'status-dot--amber' : ''}`} />{error ? 'Reconnecting' : 'API connection'}</div>
          <div className="profile-card">
            <span className="profile-avatar">{session.user.name.slice(0, 1).toUpperCase()}</span>
            <span className="profile-copy"><strong>{session.user.name}</strong><small>Administrator</small></span>
            <button className="icon-button signout-button" onClick={() => void handleSignOut()} disabled={isSigningOut}
              aria-label="Sign out" title="Sign out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main className="dashboard-main" id="dashboard">
        {activeView === 'staff' ? <SecurityStaffManagement token={session.token} /> : <>
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">MSEUF · VENUE OPERATIONS</p>
            <h1>Operations overview</h1>
            <p className="dashboard-subtitle">Monitor admissions and gate activity across your events.</p>
          </div>
          <div className="header-actions">
            <div className="event-scope-pill"><CalendarDays size={17} /><span>All events</span><ChevronDown size={16} /></div>
            <div className={`connection-pill ${error ? 'connection-pill--warning' : ''}`}>
              <span className={`status-dot ${error ? 'status-dot--amber' : ''}`} />{error ? 'Reconnecting' : 'Live'}
            </div>
            <button className="icon-button refresh-button" onClick={() => void refresh()} aria-label="Refresh metrics" title="Refresh now">
              <RefreshCw size={18} className={isLoading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {signOutError && <div className="notice notice--error" role="alert"><AlertCircle size={18} /><span>{signOutError}</span></div>}
        {error && !data && (
          <div className="notice notice--error" role="alert">
            <AlertCircle size={19} /><span>{error}</span><button onClick={() => void refresh()}>Retry</button>
          </div>
        )}
        {error && data && (
          <div className="notice notice--stale" role="status">
            <AlertCircle size={18} /><span>Could not refresh. Showing the last successful update from {formatTime(updatedAt)}.</span>
          </div>
        )}

        <section className="metrics-grid" aria-label="Event metrics">
          <MetricCard label="Tickets issued" value={data ? number.format(data.total_issued) : '—'}
            note="Issued passes across events" icon={TicketCheck} tone="saffron" />
          <MetricCard label="Students admitted" value={data ? number.format(data.total_admitted) : '—'}
            note={data ? `${admittedPercent}% of issued tickets` : 'Admissions recorded by the API'} icon={CheckCheck} tone="green" />
          <MetricCard label="Pending scanner sync"
            value={data?.pending_sync_estimate === null ? 'Not reported' : data ? number.format(data.pending_sync_estimate) : '—'}
            note="Scanner queue telemetry" icon={RefreshCw} tone="neutral" />
          <MetricCard label="Recent anomalies" value={data ? number.format(data.anomalies_count) : '—'}
            note="Requires operational review" icon={AlertCircle} tone={data && data.anomalies_count > 0 ? 'red' : 'neutral'} />
        </section>

        {isLoading && !data ? (
          <div className="loading-panel surface-card" role="status">
            <span className="loading-orb"><Activity size={21} /></span>
            <div><strong>Connecting to the event service</strong><p>Loading the latest admission metrics.</p></div>
          </div>
        ) : data ? (
          <>
            <div className="primary-panels-grid">
              <GateThroughputPanel gates={data.gates} />
              <section className="surface-card panel admission-panel" aria-labelledby="admission-title">
                <div className="panel-heading">
                  <div><span className="eyebrow">Event admissions</span><h2 id="admission-title">Admission progress</h2></div>
                  <span className="panel-icon"><DoorOpen size={19} /></span>
                </div>
                <div className="admission-gauge">
                  <div className="admission-gauge__ring" style={{ '--progress': `${admittedPercent}%` } as CSSProperties}>
                    <span>{admittedPercent}<small>%</small></span>
                  </div>
                  <strong>of issued tickets admitted</strong>
                  <p>{number.format(data.total_admitted)} admitted · {number.format(Math.max(0, data.total_issued - data.total_admitted))} remaining</p>
                </div>
                <div className="panel-footnote"><Activity size={15} /> Updated at {formatTime(updatedAt)}</div>
              </section>
            </div>
            <OperationalPanels anomalies={data.recent_anomalies} anomalyCount={data.anomalies_count} />
          </>
        ) : (
          <div className="loading-panel surface-card">
            <span className="loading-orb"><AlertCircle size={21} /></span>
            <div><strong>Metrics are unavailable</strong><p>Reconnect to the API to load current event activity.</p></div>
          </div>
        )}

        <footer className="dashboard-footer">
          <span><DoorOpen size={15} /> Event and gate management is still being connected to the API.</span>
          <span>Refreshes every 10 seconds · Last update {formatTime(updatedAt)}</span>
        </footer>
        </>}
      </main>
    </div>
  );
}
