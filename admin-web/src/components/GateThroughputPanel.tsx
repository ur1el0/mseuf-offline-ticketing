import { DoorOpen } from 'lucide-react';
import type { GateMetric } from '../types';

const number = new Intl.NumberFormat();

export function GateThroughputPanel({ gates }: { gates: GateMetric[] }) {
  return (
    <section className="surface-card panel gate-panel" aria-labelledby="gate-throughput-title">
      <div className="panel-heading">
        <div><span className="eyebrow">Admissions</span><h2 id="gate-throughput-title">Gate throughput</h2></div>
        <span className="panel-caption">Admitted / capacity</span>
      </div>
      {gates.length === 0 ? (
        <p className="empty-state">No gate metrics are available yet.</p>
      ) : (
        <ul className="gate-list">
          {gates.map((gate) => {
            const percentage = gate.capacity && gate.capacity > 0
              ? Math.min(100, Math.round((gate.admitted / gate.capacity) * 100))
              : null;
            return (
              <li className="gate-row" key={gate.gate_id}>
                <div className="gate-row__meta">
                  <div className="gate-row__name">
                    <span className="gate-row__icon"><DoorOpen size={17} strokeWidth={1.9} /></span>
                    <span>{gate.name || `Gate ${gate.gate_id}`}</span>
                  </div>
                  <div className="gate-row__counts">
                    <strong>{number.format(gate.admitted)}</strong>
                    <span>/ {gate.capacity === null ? 'Capacity not set' : number.format(gate.capacity)}</span>
                    {percentage !== null && <b>{percentage}%</b>}
                  </div>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`${gate.name || `Gate ${gate.gate_id}`} admissions`}
                  aria-valuemin={0}
                  aria-valuemax={gate.capacity ?? undefined}
                  aria-valuenow={gate.admitted}
                >
                  <span style={{ width: `${percentage ?? 0}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
