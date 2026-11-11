"use client";
import { useEffect, useState } from "react";
import { Crosshair } from "lucide-react";
import { MissionCard, MissionForm } from "../components/market";
import { Card, Empty, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { useMarket } from "../lib/api";

const TABS = [
  ["all", "All"],
  ["published", "Open for bids"],
  ["payment_pending", "Awaiting payment"],
  ["ready", "Paid"],
] as const;

export default function Missions() {
  const m = useMarket();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("all");
  const [hire, setHire] = useState<string | undefined>();
  useEffect(() => {
    setHire(new URLSearchParams(window.location.search).get("hire") ?? undefined);
  }, []);

  const rows = m.missions.filter((x) => tab === "all" || x.status === tab).slice().reverse();
  const hired = m.robots.find((r) => r.id === hire);

  return (
    <>
      <PageHeader title="Missions" sub="Publish work, review bids, award one and pay through PayPal." />
      <div className="grid split">
        <Card title="Your missions">
          <div className="tabs" role="tablist">
            {TABS.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>
                {label} {k === "all" ? `(${m.missions.length})` : `(${m.missions.filter((x) => x.status === k).length})`}
              </button>
            ))}
          </div>
          {m.error ? (
            <ErrorState message={m.error} onRetry={m.reload} />
          ) : m.loading ? (
            <Skeleton rows={4} />
          ) : rows.length === 0 ? (
            <Empty icon={Crosshair} title="No missions here">Publish a mission with the form to start collecting bids.</Empty>
          ) : (
            <div className="list">
              {rows.map((x) => (
                <MissionCard key={x.id} mission={x} robots={m.robots} bids={m.bids} onChanged={m.reload} />
              ))}
            </div>
          )}
        </Card>
        <Card title={hired ? `Hire ${hired.name}` : "Publish a mission"}>
          {!m.loading && <MissionForm key={hire ?? "new"} robots={m.robots} presetRobotId={hired?.id} onCreated={m.reload} />}
        </Card>
      </div>
    </>
  );
}
