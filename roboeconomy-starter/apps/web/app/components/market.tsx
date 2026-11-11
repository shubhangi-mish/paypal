"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { call, usd, type Bid, type Capability, type Mission, type Robot } from "../lib/api";
import { Badge, MissionStatus, RobotAvatar, SourceTag } from "./ui";

export function RobotCard({ robot }: { robot: Robot }) {
  return (
    <div className="card robot-card">
      <div className="top-row">
        <RobotAvatar capability={robot.capability} />
        <div style={{ minWidth: 0 }}>
          <h3>{robot.name}</h3>
          <div className="sub">{robot.model ?? "Model not specified"}</div>
        </div>
      </div>
      <div className="row">
        <SourceTag source={robot.source} />
        <Badge tone={robot.available ? "green" : "gray"}>{robot.available ? "Available" : "Unavailable"}</Badge>
        <Badge tone={robot.capability_verified ? "green" : "amber"}>{robot.capability_verified ? "Capability verified" : "Capability unverified"}</Badge>
      </div>
      <dl className="kv">
        <dt>Owner</dt>
        <dd>{robot.owner}</dd>
        <dt>Capability</dt>
        <dd style={{ textTransform: "capitalize" }}>{robot.capability}</dd>
        <dt>Connection</dt>
        <dd>{robot.status.replace(/-/g, " ")}</dd>
      </dl>
      <div className="spread">
        <div className="price">
          {usd(robot.rate_usd)}
          <small> /hr</small>
        </div>
        {robot.available ? (
          <Link className="btn" href={`/missions?hire=${robot.id}`}>
            Hire
          </Link>
        ) : (
          <button className="btn" disabled>
            Unavailable
          </button>
        )}
      </div>
    </div>
  );
}

export function MissionForm({ robots, presetRobotId, onCreated }: { robots: Robot[]; presetRobotId?: string; onCreated: () => void }) {
  const preset = robots.find((r) => r.id === presetRobotId);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<Capability>(preset?.capability ?? "inspection");
  const [budget, setBudget] = useState("30");
  const [robotId, setRobotId] = useState(presetRobotId ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const matching = robots.filter((r) => r.capability === type && r.available);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const mission = await call<Mission>("/api/v1/missions", "POST", { description, task_type: type, budget_usd: Number(budget) });
      let text = "Mission published.";
      if (robotId) {
        const robot = robots.find((r) => r.id === robotId)!;
        await call("/api/v1/missions/" + mission.id + "/bids", "POST", { robot_id: robotId, price_usd: Math.min(robot.rate_usd, Number(budget)) });
        text = `Mission published and ${robot.name} placed a bid. Award it below to continue to payment.`;
      }
      setMsg({ ok: true, text });
      setDescription("");
      onCreated();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label htmlFor="desc">What should the robot do?</label>
      <textarea id="desc" className="field" rows={3} required minLength={8} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Scan the factory floor and report anomalies" />
      <div className="form-grid">
        <div>
          <label htmlFor="type">Task type</label>
          <select id="type" className="field" value={type} onChange={(e) => { setType(e.target.value as Capability); setRobotId(""); }}>
            <option value="inspection">Inspection</option>
            <option value="navigation">Navigation</option>
            <option value="delivery">Delivery</option>
          </select>
        </div>
        <div>
          <label htmlFor="budget">Maximum budget (USD)</label>
          <input id="budget" className="field" type="number" min="1" step="0.01" required value={budget} onChange={(e) => setBudget(e.target.value)} />
        </div>
        <div>
          <label htmlFor="hire">Hire a specific robot (optional)</label>
          <select id="hire" className="field" value={robotId} onChange={(e) => setRobotId(e.target.value)}>
            <option value="">Open to all matching robots</option>
            {matching.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} · {usd(r.rate_usd)}/hr
              </option>
            ))}
          </select>
        </div>
      </div>
      <button className="btn" disabled={busy}>
        {busy ? "Publishing…" : robotId ? "Publish and request this robot" : "Publish mission"}
      </button>
      {msg && (
        <div className={`form-msg ${msg.ok ? "ok" : "err"}`} role="status">
          {msg.text}
        </div>
      )}
    </form>
  );
}

const STEPS = ["Published", "Awarded", "Paid", "Dispatch"];
function stepIndex(status: string) {
  return status === "published" ? 0 : status === "payment_pending" ? 1 : status === "ready" ? 2 : 0;
}

export function MissionCard({ mission, robots, bids, onChanged }: { mission: Mission; robots: Robot[]; bids: Bid[]; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const name = (id: string) => robots.find((r) => r.id === id)?.name ?? id.slice(0, 8);
  const mine = bids.filter((b) => b.mission_id === mission.id);
  const bidders = new Set(mine.map((b) => b.robot_id));
  const candidates = robots.filter((r) => r.capability === mission.task_type && r.available && !bidders.has(r.id));
  const step = stepIndex(mission.status);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  const pay = () =>
    act(async () => {
      const order = await call<{ approve_url?: string }>("/api/v1/payments/orders", "POST", { mission_id: mission.id });
      if (order.approve_url) window.location.assign(order.approve_url);
      else throw new Error("PayPal did not return an approval link");
    });

  return (
    <div className="list-item">
      <div className="spread">
        <div style={{ minWidth: 0 }}>
          <strong>{mission.description}</strong>
          <span className="sub" style={{ textTransform: "capitalize" }}>
            {mission.task_type} · budget {usd(mission.budget_usd)}
          </span>
        </div>
        <MissionStatus status={mission.status} />
      </div>
      <div className="row sub" style={{ margin: "10px 0 4px" }} aria-label={`Progress: ${STEPS[step]}`}>
        {STEPS.map((s, i) => (
          <span key={s} className="row" style={{ gap: 4, color: i <= step ? "var(--green)" : "var(--muted)" }}>
            {i <= step ? <CheckCircle2 size={14} /> : <CircleDashed size={14} />} {s}
            {i < STEPS.length - 1 && <span style={{ margin: "0 4px", opacity: 0.4 }}>—</span>}
          </span>
        ))}
      </div>
      {mine.map((b) => (
        <div className="bid-row" key={b.id}>
          <span>
            <strong style={{ display: "inline" }}>{name(b.robot_id)}</strong> bid {usd(b.price_usd)} · <span className="sub">{b.status}</span>
          </span>
          {mission.status === "published" && (
            <button className="btn sm" disabled={busy} onClick={() => act(() => call(`/api/v1/missions/${mission.id}/award/${b.id}`, "POST"))}>
              Award
            </button>
          )}
        </div>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        {mission.status === "published" &&
          candidates.map((r) => (
            <button key={r.id} className="btn ghost sm" disabled={busy} onClick={() => act(() => call(`/api/v1/missions/${mission.id}/bids`, "POST", { robot_id: r.id, price_usd: Math.min(r.rate_usd, mission.budget_usd) }))}>
              Bid as {r.name}
            </button>
          ))}
        {mission.status === "payment_pending" && (
          <button className="btn" disabled={busy} onClick={pay}>
            Pay with PayPal
          </button>
        )}
        {mission.status === "ready" && <span className="sub">Payment confirmed. Robot dispatch is not implemented yet.</span>}
      </div>
      {err && (
        <div className="form-msg err" role="alert">
          {err}
        </div>
      )}
    </div>
  );
}
