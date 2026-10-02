import { AlertTriangle, Clock3, Radio, ShieldAlert } from 'lucide-react';
import type { Anomaly } from '../types';

function formatTime(value: string | null): string {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function AnomalyList({ anomalies, emptyText }: { anomalies: Anomaly[]; emptyText: string }) {
  if (anomalies.length === 0) return <p className="empty-state">{emptyText}</p>;

  return (
    <ul className="activity-list">
      {anomalies.slice(0, 4).map((item) => {
        const isOverride = item.anomaly_type.toUpperCase().includes('OVERRIDE');
        return (
          <li className="activity-item" key={item.id}>
            <span className={`activity-icon ${isOverride ? 'activity-icon--amber' : 'activity-icon--red'}`}>
              {isOverride ? <ShieldAlert size={17} /> : <AlertTriangle size={17} />}
            </span>
            <div className="activity-copy">
              <strong>{item.anomaly_type.replaceAll('_', ' ')}</strong>
              <span>Ticket #{item.ticket_id} · {item.device_id}</span>
            </div>
            <time>{formatTime(item.server_received_at)}</time>
          </li>
        );
      })}
    </ul>
  );
}

export function OperationalPanels({ anomalies, anomalyCount }: { anomalies: Anomaly[]; anomalyCount: number }) {
  const overrides = anomalies.filter((item) => item.anomaly_type.toUpperCase().includes('OVERRIDE'));

  return (
    <div className="operations-grid">
      <section className="surface-card panel operations-panel" aria-labelledby="alerts-title">
        <div className="panel-heading">
          <div><span className="eyebrow">Review required</span><h2 id="alerts-title">Forensic alerts</h2></div>
          <span className="count-pill count-pill--red">{anomalyCount} total</span>
        </div>
        <AnomalyList anomalies={anomalies} emptyText="No recent anomalies have been reported." />
      </section>
      <section className="surface-card panel operations-panel" aria-labelledby="overrides-title">
        <div className="panel-heading">
          <div><span className="eyebrow">Staff actions</span><h2 id="overrides-title">Marshal overrides</h2></div>
          <span className="count-pill count-pill--amber">{overrides.length} recent</span>
        </div>
        <AnomalyList anomalies={overrides} emptyText="No marshal overrides have been reported." />
      </section>
      <section className="surface-card panel scanner-panel" aria-labelledby="scanner-title">
        <div className="panel-heading">
          <div><span className="eyebrow">Device status</span><h2 id="scanner-title">Scanner health</h2></div>
          <span className="panel-icon"><Radio size={19} /></span>
        </div>
        <div className="telemetry-empty">
          <span className="telemetry-empty__icon"><Radio size={21} /></span>
          <strong>Scanner telemetry is not connected</strong>
          <p>Device heartbeat data will appear when scanner status reporting is available.</p>
        </div>
      </section>
      <section className="surface-card panel sync-panel" aria-labelledby="sync-title">
        <div className="panel-heading">
          <div><span className="eyebrow">Offline operations</span><h2 id="sync-title">Pending scanner sync</h2></div>
          <span className="panel-icon"><Clock3 size={19} /></span>
        </div>
        <div className="sync-summary">
          <strong>Not reported</strong>
          <p>Queued scan counts are not included in the current metrics API.</p>
        </div>
      </section>
    </div>
  );
}
