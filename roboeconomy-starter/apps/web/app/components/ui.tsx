import type { ReactNode } from "react";
import { AlertTriangle, Bot, Eye, Navigation, Package, type LucideIcon } from "lucide-react";
import type { Capability, Source } from "../lib/api";

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "blue" | "green" | "amber" | "red" | "violet" | "gray";
export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

/** Every data source is labelled so simulation, replay, physical and demo data are never confused. */
export function SourceTag({ source }: { source: Source }) {
  const map = { simulated: ["violet", "Simulation"], replay: ["amber", "Replay"], physical: ["green", "Physical"] } as const;
  const [tone, label] = map[source];
  return <Badge tone={tone}>{label}</Badge>;
}

export function MissionStatus({ status }: { status: string }) {
  const map: Record<string, [Tone, string]> = {
    published: ["blue", "Open for bids"],
    payment_pending: ["amber", "Awaiting payment"],
    ready: ["green", "Paid · ready"],
  };
  const [tone, label] = map[status] ?? ["gray", status.replace(/_/g, " ")];
  return <Badge tone={tone}>{label}</Badge>;
}

export const capabilityIcon: Record<Capability, LucideIcon> = { inspection: Eye, navigation: Navigation, delivery: Package };

export function RobotAvatar({ capability, size = 44 }: { capability?: Capability; size?: number }) {
  const Icon = capability ? capabilityIcon[capability] : Bot;
  return (
    <div className="avatar" style={{ width: size, height: size }} aria-hidden>
      <Icon size={size * 0.5} />
    </div>
  );
}

export function Empty({ icon: Icon = Bot, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <Icon size={26} aria-hidden />
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="empty error" role="alert">
      <AlertTriangle size={26} aria-hidden />
      <strong>Cannot load data</strong>
      <p>{message}</p>
      {onRetry && (
        <button className="btn ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div className="skeleton" key={i} />
      ))}
    </div>
  );
}

export function Stat({ label, value, hint, icon: Icon }: { label: string; value: ReactNode; hint?: string; icon?: LucideIcon }) {
  return (
    <div className="card stat">
      {Icon && (
        <div className="stat-icon" aria-hidden>
          <Icon size={20} />
        </div>
      )}
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </div>
  );
}

export function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bars" role="img" aria-label={label}>
      {data.map((d, i) => (
        <div className="bar-col" key={i}>
          <span className="bar-val">{d.value}</span>
          <div className="bar" style={{ height: `${Math.max((d.value / max) * 100, 3)}%` }} />
          <span className="bar-lbl">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
