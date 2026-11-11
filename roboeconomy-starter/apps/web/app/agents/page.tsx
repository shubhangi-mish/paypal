"use client";
import { BrainCircuit, Gavel, Network, RefreshCw, Search, ShieldCheck, Sparkles, Users, type LucideIcon } from "lucide-react";
import { Badge, Card, Empty, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { useMarket, usd } from "../lib/api";

type Stage = { icon: LucideIcon; name: string; tone: "green" | "amber" | "gray"; state: string; detail: string };
// Statuses describe what the code does today. Nothing here is a live agent run.
const STAGES: Stage[] = [
  { icon: Sparkles, name: "Mission interpretation", tone: "gray", state: "Not implemented", detail: "Mission text is stored verbatim. No LLM parses it into structured requirements." },
  { icon: Search, name: "Robot discovery", tone: "amber", state: "Rule-based", detail: "A robot can only bid if its capability equals the mission's task type and it is marked available." },
  { icon: Gavel, name: "Bidding and negotiation", tone: "amber", state: "Rule-based", detail: "Bids are placed at the robot's listed hourly rate, capped at the budget. There are no counter-offers." },
  { icon: Users, name: "Coalition formation", tone: "gray", state: "Not implemented", detail: "Multi-robot teams are planned (OR-Tools feasibility). Not built." },
  { icon: Network, name: "RL decisions", tone: "amber", state: "Offline only", detail: "A Gymnasium environment exists with synthetic dynamics. Evaluation on held-out seeds: random 1.13, greedy 3.55, oracle upper bound 3.89 mean net value. Not connected to the marketplace and not validated in Gazebo." },
  { icon: ShieldCheck, name: "Risk validation", tone: "amber", state: "Budget check only", detail: "The API rejects bids above the mission budget. Deadline, battery and capacity checks are not implemented." },
  { icon: RefreshCw, name: "Recovery events", tone: "gray", state: "Not implemented", detail: "Needs live simulator telemetry to detect failures." },
];

export default function Agents() {
  const m = useMarket();
  const name = (id: string) => m.robots.find((r) => r.id === id)?.name ?? id.slice(0, 8);
  const auctions = m.missions.filter((x) => m.bids.some((b) => b.mission_id === x.id)).slice().reverse();

  return (
    <>
      <PageHeader title="AI Intelligence Lab" sub="What the coordination layer does today, and the real decision log it produces." />
      <Card title="Agent workflow" action={<Badge tone="violet">{m.system?.agents.implemented ? "Agents running" : "No autonomous agents running"}</Badge>}>
        {STAGES.map(({ icon: Icon, name: n, tone, state, detail }) => (
          <div className="stage" key={n}>
            <div className="stage-dot">
              <Icon size={16} aria-hidden />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="spread">
                <strong>{n}</strong>
                <Badge tone={tone}>{state}</Badge>
              </div>
              <p className="sub">{detail}</p>
            </div>
          </div>
        ))}
      </Card>

      <Card title="Decision trace: auctions" className="mt">
        <p className="sub" style={{ marginBottom: 12 }}>
          Built from real bids stored in the database. Each line is a rule-based outcome, not an agent explanation.
        </p>
        {m.error ? (
          <ErrorState message={m.error} onRetry={m.reload} />
        ) : m.loading ? (
          <Skeleton />
        ) : auctions.length === 0 ? (
          <Empty icon={BrainCircuit} title="No auctions yet">Publish a mission and place a bid to see its trace here.</Empty>
        ) : (
          <div className="list">
            {auctions.map((x) => {
              const bids = m.bids.filter((b) => b.mission_id === x.id).sort((a, b) => a.price_usd - b.price_usd);
              return (
                <div className="list-item" key={x.id}>
                  <strong>{x.description}</strong>
                  <span className="sub">Budget {usd(x.budget_usd)} · {bids.length} bid{bids.length === 1 ? "" : "s"}</span>
                  {bids.map((b) => (
                    <div className="bid-row" key={b.id}>
                      <span>
                        {name(b.robot_id)} bid {usd(b.price_usd)} ({Math.round((b.price_usd / x.budget_usd) * 100)}% of budget)
                      </span>
                      <Badge tone={b.status === "awarded" ? "green" : "gray"}>{b.status === "awarded" ? "awarded by buyer" : b.status}</Badge>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
