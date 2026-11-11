"use client";
import { BarChart3 } from "lucide-react";
import { BarChart, Card, Empty, ErrorState, PageHeader, Skeleton, Stat } from "../components/ui";
import { useMarket, usd } from "../lib/api";

export default function Analytics() {
  const m = useMarket();
  const count = <T,>(items: T[], key: (t: T) => string) => {
    const out: Record<string, number> = {};
    items.forEach((i) => (out[key(i)] = (out[key(i)] ?? 0) + 1));
    return Object.entries(out).map(([label, value]) => ({ label, value }));
  };
  const withBids = m.missions.filter((x) => m.bids.some((b) => b.mission_id === x.id));
  const avgBids = m.missions.length ? (m.bids.length / m.missions.length).toFixed(1) : "—";
  const lowest = withBids.map((x) => Math.min(...m.bids.filter((b) => b.mission_id === x.id).map((b) => b.price_usd)) / x.budget_usd);
  const avgPct = lowest.length ? `${Math.round((lowest.reduce((a, b) => a + b, 0) / lowest.length) * 100)}%` : "—";
  const volume = m.payments.filter((p) => p.status === "CAPTURED").reduce((s, p) => s + p.amount_usd, 0);

  return (
    <>
      <PageHeader title="Analytics" sub="Computed live from the marketplace database. No sample data." />
      {m.error ? (
        <ErrorState message={m.error} onRetry={m.reload} />
      ) : m.loading ? (
        <Skeleton rows={3} />
      ) : (
        <>
          <div className="grid g4">
            <Stat icon={BarChart3} label="Missions" value={m.missions.length} />
            <Stat label="Bids per mission" value={avgBids} hint="average" />
            <Stat label="Lowest bid vs budget" value={avgPct} hint="average across missions with bids" />
            <Stat label="Captured volume" value={usd(volume)} hint="PayPal-confirmed" />
          </div>
          <div className="grid g3 mt">
            <Card title="Missions by status">
              {m.missions.length ? <BarChart label="Missions by status" data={count(m.missions, (x) => x.status.replace(/_/g, " "))} /> : <Empty title="No missions yet" />}
            </Card>
            <Card title="Robots by capability">
              {m.robots.length ? <BarChart label="Robots by capability" data={count(m.robots, (r) => r.capability)} /> : <Empty title="No robots yet" />}
            </Card>
            <Card title="Robots by connection type">
              {m.robots.length ? <BarChart label="Robots by connection type" data={count(m.robots, (r) => r.source)} /> : <Empty title="No robots yet" />}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
