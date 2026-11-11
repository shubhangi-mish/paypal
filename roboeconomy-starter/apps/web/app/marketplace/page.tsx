"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { RobotCard } from "../components/market";
import { Empty, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { useMarket, type Capability, type Source } from "../lib/api";

export default function Marketplace() {
  const m = useMarket();
  const [q, setQ] = useState("");
  const [cap, setCap] = useState<"all" | Capability>("all");
  const [src, setSrc] = useState<"all" | Source>("all");
  const [onlyAvail, setOnlyAvail] = useState(false);

  useEffect(() => {
    setQ(new URLSearchParams(window.location.search).get("q") ?? "");
  }, []);

  const needle = q.trim().toLowerCase();
  const rows = m.robots.filter(
    (r) =>
      (cap === "all" || r.capability === cap) &&
      (src === "all" || r.source === src) &&
      (!onlyAvail || r.available) &&
      (!needle || [r.name, r.owner, r.capability, r.model ?? ""].some((v) => v.toLowerCase().includes(needle))),
  );

  return (
    <>
      <PageHeader title="Marketplace" sub="Robot services you can hire. Prices are each owner's listed hourly rate." />
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="form-grid" style={{ alignItems: "end" }}>
          <div>
            <label htmlFor="q">Search</label>
            <input id="q" className="field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, owner, capability, model" style={{ marginBottom: 0 }} />
          </div>
          <div>
            <label htmlFor="cap">Capability</label>
            <select id="cap" className="field" value={cap} onChange={(e) => setCap(e.target.value as typeof cap)} style={{ marginBottom: 0 }}>
              <option value="all">All</option>
              <option value="inspection">Inspection</option>
              <option value="navigation">Navigation</option>
              <option value="delivery">Delivery</option>
            </select>
          </div>
          <div>
            <label htmlFor="src">Connection type</label>
            <select id="src" className="field" value={src} onChange={(e) => setSrc(e.target.value as typeof src)} style={{ marginBottom: 0 }}>
              <option value="all">All</option>
              <option value="simulated">Simulation</option>
              <option value="replay">Replay</option>
              <option value="physical">Physical</option>
            </select>
          </div>
          <label className="row" style={{ paddingBottom: 8 }}>
            <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} /> Available only
          </label>
        </div>
      </div>
      {m.error ? (
        <ErrorState message={m.error} onRetry={m.reload} />
      ) : m.loading ? (
        <Skeleton rows={4} />
      ) : rows.length === 0 ? (
        <Empty icon={Bot} title={m.robots.length ? "No robots match these filters" : "No robots listed yet"} action={<Link className="btn" href="/robots">Register a robot</Link>}>
          {m.robots.length ? "Try clearing a filter." : "Robot owners can list a service from My Robots."}
        </Empty>
      ) : (
        <div className="grid g4">
          {rows.map((r) => (
            <RobotCard key={r.id} robot={r} />
          ))}
        </div>
      )}
    </>
  );
}
