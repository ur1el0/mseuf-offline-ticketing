import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  tone: 'saffron' | 'green' | 'neutral' | 'red';
}

export function MetricCard({ label, value, note, icon: Icon, tone }: MetricCardProps) {
  return (
    <article className="metric-card surface-card">
      <div className="metric-card__top">
        <span className="metric-card__label">{label}</span>
        <span className={`icon-bubble icon-bubble--${tone}`} aria-hidden="true">
          <Icon size={19} strokeWidth={1.9} />
        </span>
      </div>
      <strong className={`metric-card__value metric-card__value--${tone}`}>{value}</strong>
      <span className="metric-card__note">{note}</span>
    </article>
  );
}
