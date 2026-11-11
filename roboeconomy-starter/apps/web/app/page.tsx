"use client";
import Link from "next/link";
import { ArrowRight, Boxes, Bot, Crosshair, Wallet, Hourglass } from "lucide-react";
import { MissionForm, RobotCard } from "./components/market";
import { BarChart, Card, Empty, ErrorState, MissionStatus, Skeleton, Stat } from "./components/ui";
import { captured, useMarket, usd } from "./lib/api";

function HeroArt() {
  // Decorative network graph only. It carries no data and is hidden from assistive tech.
  const nodes: [number, number][] = [[60, 60], [200, 40], [330, 110], [150, 150], [290, 210], [90, 250], [230, 300], [360, 300]];
  const edges = [[0, 1], [1, 2], [0, 3], [3, 4], [2, 4], [3, 5], [4, 6], [6, 7], [5, 6], [2, 7]];
  return (
    <svg className="hero-art" viewBox="0 0 420 340" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {edges.map(([a, b], i) => (
        <line key={i} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} stroke="url(#g)" strokeOpacity=".45" strokeWidth="1.5" />
      ))}
      {nodes.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="16" fill="#38bdf8" fillOpacity=".12" />
          <circle cx={x} cy={y} r="5" fill="url(#g)" />
        </g>
      ))}
    </svg>
  );
}

export default function Home() {
  const m = useMarket();
  const confirmed = m.payments.filter(captured);
  const total = confirmed.reduce((s, p) => s + p.amount_usd, 0);
  const awaiting = m.missions.filter((x) => x.status === "payment_pending").length;
  const open = m.missions.filter((x) => x.status === "published").length;
  const active = m.missions.filter((x) => x.status !== "ready").slice(0, 4);

  return (
    <>
      <section className="hero">
        <HeroArt />
        <div className="hero-body">
          <div className="eyebrow">THE AUTONOMOUS MACHINE ECONOMY</div>
          <h1>Put robots to work. Get paid with PayPal.</h1>
          <p>List robot services, publish missions, collect bids and settle through PayPal Sandbox. Simulation and agent coordination are connected as they come online, and every screen says which data is real.</p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link className="btn" href="/marketplace">
              Explore marketplace <ArrowRight size={16} />
            </Link>
            <Link className="btn ghost" href="/robots">
              Register a robot
            </Link>
          </div>
        </div>
      </section>

      {m.error ? (
        <ErrorState message={m.error} onRetry={m.reload} />
      ) : (
        <>
          <div className="grid g4">
            <Stat icon={Bot} label="Robots registered" value={m.loading ? "…" : m.robots.length} hint={`${m.robots.filter((r) => r.available).length} available`} />
            <Stat icon={Crosshair} label="Open for bids" value={m.loading ? "…" : open} hint="published missions" />
            <Stat icon={Hourglass} label="Awaiting payment" value={m.loading ? "…" : awaiting} hint="awarded, not yet paid" />
            <Stat icon={Wallet} label="Confirmed earnings" value={m.loading ? "…" : usd(total)} hint={`${confirmed.length} captured PayPal payment${confirmed.length === 1 ? "" : "s"}`} />
          </div>

          <div className="grid g2 mt">
            <Card title="Robot marketplace" action={<Link className="card-link" href="/marketplace">View all →</Link>}>
              {m.loading ? (
                <Skeleton />
              ) : m.robots.length === 0 ? (
                <Empty icon={Bot} title="No robots listed yet" action={<Link className="btn" href="/robots">Register the first robot</Link>}>
                  Robot owners list a service here. Buyers hire from this list.
                </Empty>
              ) : (
                <div className="grid g2">
                  {m.robots.slice(0, 4).map((r) => (
                    <RobotCard key={r.id} robot={r} />
                  ))}
                </div>
              )}
            </Card>

            <Card title="Create a mission">
              <MissionForm robots={m.robots} onCreated={m.reload} />
              <p className="sub" style={{ marginTop: 12 }}>
                Mission text is stored as written. Automatic AI interpretation is not implemented yet.
              </p>
            </Card>
          </div>

          <div className="grid g3 mt">
            <Card title="Live simulation" action={<Link className="card-link" href="/simulation">Open →</Link>}>
              <Empty icon={Boxes} title={m.system?.simulator.connected ? "Simulator connected" : "No simulator connected"}>
                {m.system?.simulator.detail ?? "Checking simulator status…"}
              </Empty>
            </Card>

            <Card title="Confirmed payments" action={<Link className="card-link" href="/earnings">Details →</Link>}>
              {confirmed.length === 0 ? (
                <Empty icon={Wallet} title="No captured payments yet">Earnings appear here after a buyer approves a PayPal payment and it is captured.</Empty>
              ) : (
                <BarChart label="Captured payment amounts in USD" data={confirmed.slice(-8).map((p, i) => ({ label: `#${confirmed.length - Math.min(8, confirmed.length) + i + 1}`, value: p.amount_usd }))} />
              )}
            </Card>

            <Card title="Active missions" action={<Link className="card-link" href="/missions">View all →</Link>}>
              {m.loading ? (
                <Skeleton />
              ) : active.length === 0 ? (
                <Empty icon={Crosshair} title="No active missions">Published missions that are not yet paid show up here.</Empty>
              ) : (
                <div className="list">
                  {active.map((x) => (
                    <div className="list-item" key={x.id}>
                      <div className="spread">
                        <strong style={{ minWidth: 0 }}>{x.description}</strong>
                        <span className="sub">{usd(x.budget_usd)}</span>
                      </div>
                      <MissionStatus status={x.status} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
