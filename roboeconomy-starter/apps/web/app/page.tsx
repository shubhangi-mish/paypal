"use client";
import { useCallback, useEffect, useState } from "react";

type Robot = { id: string; name: string; owner: string; capability: string; rate_usd: number; status: string };
type Mission = { id: string; description: string; task_type: string; budget_usd: number; status: string; awarded_bid_id?: string | null };
type Bid = { id: string; mission_id: string; robot_id: string; price_usd: number; status: string };

// "/" (set on Vercel) strips to "" = same-origin; undefined falls back to local FastAPI.
const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export default function Home() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [bids, setBids] = useState<Record<string, Bid[]>>({});
  const [message, setMessage] = useState("");
  const [name, setName] = useState("TurtleBot Alpha");
  const [owner, setOwner] = useState("Robot Owner A");
  const [rate, setRate] = useState("12");
  const [description, setDescription] = useState("Inspect warehouse zone A and report completion");
  const [budget, setBudget] = useState("30");

  const refresh = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([fetch(`${API}/api/v1/robots`), fetch(`${API}/api/v1/missions`)]);
      if (!r.ok || !m.ok) throw new Error("bad status");
      const missionList: Mission[] = await m.json();
      setRobots(await r.json());
      setMissions(missionList);
      const entries = await Promise.all(
        missionList.map(async (x) => {
          const res = await fetch(`${API}/api/v1/missions/${x.id}/bids`);
          return [x.id, res.ok ? ((await res.json()) as Bid[]) : []] as const;
        }),
      );
      setBids(Object.fromEntries(entries));
    } catch {
      setMessage("Cannot reach the API. Locally, start FastAPI on port 8000; on Vercel, check DATABASE_URL.");
    }
  }, []);

  const request = useCallback(
    async (path: string, payload?: object) => {
      try {
        const r = await fetch(`${API}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload ? JSON.stringify(payload) : undefined,
        });
        const data = await r.json();
        if (!r.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
        setMessage(JSON.stringify(data, null, 2));
        await refresh();
        return data;
      } catch (e) {
        setMessage(String(e));
      }
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // PayPal redirects back with ?checkout=success&token=<order id>. Capture it server-side.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (params.get("checkout") === "success" && token) {
      window.history.replaceState({}, "", window.location.pathname);
      request(`/api/v1/payments/orders/${encodeURIComponent(token)}/capture`);
    } else if (params.get("checkout") === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
      setMessage("Checkout cancelled. The mission is still awaiting payment.");
    }
  }, [request]);

  async function checkout(missionId: string) {
    const order = await request("/api/v1/payments/orders", { mission_id: missionId });
    if (order?.approve_url) window.location.assign(order.approve_url);
  }

  const robotName = (id: string) => robots.find((r) => r.id === id)?.name ?? id.slice(0, 8);

  return (
    <>
      <header>
        <strong>◈ roboeconomy</strong>
        <span className="pill">Hackathon prototype · PayPal Sandbox</span>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">THE AUTONOMOUS MACHINE ECONOMY</div>
          <h1>
            Put your robots to work.
            <br />
            Hire intelligence on demand.
          </h1>
          <p>
            Register robot services, publish missions, collect bids, award a bid and pay through PayPal Sandbox. Robot
            execution is not connected yet.
          </p>
        </section>
        <div className="grid">
          <section className="card">
            <h2>Earn with my robot</h2>
            <p>Register a simulated robot and make its services discoverable.</p>
            <label>Robot name</label>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
            <label>Owner</label>
            <input className="field" value={owner} onChange={(e) => setOwner(e.target.value)} />
            <label>Hourly rate (USD)</label>
            <input className="field" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            <button
              className="btn"
              onClick={() =>
                request("/api/v1/robots", { name, owner, rate_usd: Number(rate), capability: "inspection", source: "simulated" })
              }
            >
              Register simulated robot
            </button>
          </section>
          <section className="card">
            <h2>Hire a robot</h2>
            <p>Publish an inspection mission for available robot operators.</p>
            <label>Mission description</label>
            <textarea className="field" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            <label>Maximum budget (USD)</label>
            <input className="field" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} />
            <button
              className="btn"
              onClick={() => request("/api/v1/missions", { description, task_type: "inspection", budget_usd: Number(budget) })}
            >
              Publish mission
            </button>
          </section>
        </div>
        {message && <pre className="status">{message}</pre>}
        <section className="grid" style={{ marginTop: 22 }}>
          <div className="card">
            <h2>
              Registered robots <span className="muted">({robots.length})</span>
            </h2>
            {robots.map((r) => (
              <div className="item" key={r.id}>
                <strong>{r.name}</strong>
                <p>
                  {r.owner} · ${r.rate_usd}/hr · {r.status}
                </p>
              </div>
            ))}
            {!robots.length && <p>No robots yet.</p>}
          </div>
          <div className="card">
            <h2>
              Missions <span className="muted">({missions.length})</span>
            </h2>
            {missions.map((m) => (
              <div className="item" key={m.id}>
                <strong>{m.description}</strong>
                <p>
                  Budget ${m.budget_usd} · {m.status.replace("_", " ")}
                </p>
                {(bids[m.id] ?? []).map((b) => (
                  <p key={b.id}>
                    {robotName(b.robot_id)} bid ${b.price_usd} · {b.status}
                    {m.status === "published" && (
                      <button className="btn" style={{ marginLeft: 8 }} onClick={() => request(`/api/v1/missions/${m.id}/award/${b.id}`)}>
                        Award
                      </button>
                    )}
                  </p>
                ))}
                {m.status === "published" &&
                  robots
                    .filter((r) => r.capability === m.task_type)
                    .map((r) => (
                      <button
                        key={r.id}
                        className="btn"
                        style={{ marginRight: 8, marginBottom: 8 }}
                        onClick={() => request(`/api/v1/missions/${m.id}/bids`, { robot_id: r.id, price_usd: Math.min(r.rate_usd, m.budget_usd) })}
                      >
                        Bid with {r.name}
                      </button>
                    ))}
                {m.status === "payment_pending" && (
                  <button className="btn" onClick={() => checkout(m.id)}>
                    Pay with PayPal (Sandbox)
                  </button>
                )}
                {m.status === "ready" && <p>Paid. Awaiting robot dispatch (not yet implemented).</p>}
              </div>
            ))}
            {!missions.length && <p>No missions yet.</p>}
          </div>
        </section>
        <p className="muted">
          Bids are placed at the robot&apos;s listed rate; there is no AI negotiation yet. No robot is physically connected.
          Payments only succeed with a configured PayPal Sandbox account.
        </p>
      </main>
      <footer>RoboEconomy · Open-source hackathon foundation</footer>
    </>
  );
}
