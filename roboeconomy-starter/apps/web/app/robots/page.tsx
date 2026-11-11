"use client";
import { useState } from "react";
import { Bot } from "lucide-react";
import { Badge, Card, Empty, ErrorState, MissionStatus, PageHeader, RobotAvatar, Skeleton, SourceTag } from "../components/ui";
import { call, captured, useMarket, usd, type Capability, type Robot, type Source } from "../lib/api";

function RegisterForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ name: "", model: "", owner: "", capability: "inspection" as Capability, rate: "12", source: "simulated" as Source });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await call("/api/v1/robots", "POST", { name: f.name, owner: f.owner, capability: f.capability, rate_usd: Number(f.rate), source: f.source, model: f.model || null });
      setMsg({ ok: true, text: `${f.name} registered. It is not connected to a live robot yet.` });
      setF((s) => ({ ...s, name: "", model: "" }));
      onDone();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label htmlFor="rn">Robot name</label>
      <input id="rn" className="field" required minLength={2} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="TurtleBot Alpha" />
      <label htmlFor="rm">Model</label>
      <input id="rm" className="field" value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="TurtleBot3 Burger" />
      <label htmlFor="ro">Owner</label>
      <input id="ro" className="field" required minLength={2} value={f.owner} onChange={(e) => set("owner", e.target.value)} placeholder="Your name or company" />
      <div className="form-grid">
        <div>
          <label htmlFor="rc">Capability</label>
          <select id="rc" className="field" value={f.capability} onChange={(e) => set("capability", e.target.value as Capability)}>
            <option value="inspection">Inspection</option>
            <option value="navigation">Navigation</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>
        <div>
          <label htmlFor="rs">Connection type</label>
          <select id="rs" className="field" value={f.source} onChange={(e) => set("source", e.target.value as Source)}>
            <option value="simulated">Simulation</option>
            <option value="replay">Replay</option>
            <option value="physical">Physical</option>
          </select>
        </div>
      </div>
      <label htmlFor="rr">Service price (USD per hour)</label>
      <input id="rr" className="field" type="number" min="1" step="0.5" required value={f.rate} onChange={(e) => set("rate", e.target.value)} />
      <button className="btn" disabled={busy}>
        {busy ? "Registering…" : "Register robot"}
      </button>
      {msg && (
        <div className={`form-msg ${msg.ok ? "ok" : "err"}`} role="status">
          {msg.text}
        </div>
      )}
    </form>
  );
}

function OwnedRobot({ robot, m }: { robot: Robot; m: ReturnType<typeof useMarket> }) {
  const [rate, setRate] = useState(String(robot.rate_usd));
  const [err, setErr] = useState<string | null>(null);
  const myBids = m.bids.filter((b) => b.robot_id === robot.id);
  const won = myBids.filter((b) => m.missions.find((x) => x.id === b.mission_id)?.awarded_bid_id === b.id);
  const earned = won.reduce((sum, b) => sum + m.payments.filter((p) => p.mission_id === b.mission_id && captured(p)).reduce((s, p) => s + p.amount_usd, 0), 0);

  async function patch(body: object) {
    setErr(null);
    try {
      await call(`/api/v1/robots/${robot.id}`, "PATCH", body);
      await m.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }
  return (
    <div className="list-item">
      <div className="spread">
        <div className="row">
          <RobotAvatar capability={robot.capability} />
          <div>
            <strong>{robot.name}</strong>
            <span className="sub">
              {robot.model ?? "Model not specified"} · {robot.owner}
            </span>
          </div>
        </div>
        <div className="row">
          <SourceTag source={robot.source} />
          <Badge tone="gray">{robot.status.replace(/-/g, " ")}</Badge>
        </div>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={robot.available} onChange={(e) => patch({ available: e.target.checked })} /> Available for jobs
        </label>
        <label className="row" style={{ gap: 6 }}>
          Price $/hr
          <input className="field" style={{ width: 90, margin: 0, padding: "6px 8px" }} type="number" min="1" step="0.5" value={rate} onChange={(e) => setRate(e.target.value)} aria-label={`Hourly price for ${robot.name}`} />
        </label>
        <button className="btn ghost sm" disabled={Number(rate) <= 0 || Number(rate) === robot.rate_usd} onClick={() => patch({ rate_usd: Number(rate) })}>
          Save price
        </button>
      </div>
      <div className="sub" style={{ marginTop: 10 }}>
        Offers placed: {myBids.length} · Won: {won.length} · Confirmed earnings: <strong style={{ display: "inline", color: "var(--text)" }}>{usd(earned)}</strong>
      </div>
      {myBids.map((b) => {
        const mission = m.missions.find((x) => x.id === b.mission_id);
        return (
          <div className="bid-row" key={b.id}>
            <span>
              {mission?.description ?? "Mission"} · {usd(b.price_usd)}
            </span>
            {mission && <MissionStatus status={mission.status} />}
          </div>
        );
      })}
      {err && (
        <div className="form-msg err" role="alert">
          {err}
        </div>
      )}
    </div>
  );
}

export default function MyRobots() {
  const m = useMarket();
  return (
    <>
      <PageHeader title="My Robots" sub="List a robot, set its availability and price, and follow its offers and earnings." />
      <div className="grid split">
        <Card title={`Registered robots (${m.robots.length})`}>
          {m.error ? (
            <ErrorState message={m.error} onRetry={m.reload} />
          ) : m.loading ? (
            <Skeleton rows={3} />
          ) : m.robots.length === 0 ? (
            <Empty icon={Bot} title="No robots yet">Register your first robot with the form. Connecting real hardware or Gazebo comes later.</Empty>
          ) : (
            <div className="list">
              {m.robots.map((r) => (
                <OwnedRobot key={r.id} robot={r} m={m} />
              ))}
            </div>
          )}
          <p className="sub" style={{ marginTop: 14 }}>
            There are no user accounts yet, so every robot is visible here and the buyer awards bids. Owner approval and ownership checks are not implemented.
          </p>
        </Card>
        <Card title="Connect a robot">
          <RegisterForm onDone={m.reload} />
        </Card>
      </div>
    </>
  );
}
