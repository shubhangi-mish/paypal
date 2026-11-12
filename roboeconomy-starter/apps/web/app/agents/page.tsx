"use client";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2 } from "lucide-react";
import { Badge, Card, Empty, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { call, useApi, useMarket, usd, type AuditEntry, type Benchmarks, type Decision, type Mission } from "../lib/api";

const AGENT_LABEL: Record<string, string> = {
  mission_interpreter: "Mission interpreter",
  discovery: "Discovery",
  negotiation: "Negotiation",
  risk: "Risk review",
  explanation: "Explanation",
  monitor: "Failure monitor",
  recovery: "Recovery",
};

function EngineTag({ engine }: { engine: string }) {
  const tone = engine.startsWith("llm") ? "violet" : engine === "operator-injected" ? "amber" : "gray";
  return <Badge tone={tone}>{engine}</Badge>;
}

function Rounds({ evidence }: { evidence: Record<string, unknown> }) {
  const rounds = evidence.rounds as { round: number; buyer_offer_minor: number; robot_counter_minor: number }[] | undefined;
  if (!rounds?.length) return null;
  return (
    <div className="scroll-x">
      <table className="table" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Round</th>
            <th>Buyer offers</th>
            <th>Robot counters</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => (
            <tr key={r.round}>
              <td>{r.round}</td>
              <td>{usd(r.buyer_offer_minor / 100)}</td>
              <td>{usd(r.robot_counter_minor / 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sub">Owner floor {usd((evidence.owner_floor_minor as number) / 100)} · budget {usd((evidence.budget_minor as number) / 100)}. Both are hard limits.</p>
    </div>
  );
}

function Trace({ mission, m }: { mission: Mission; m: ReturnType<typeof useMarket> }) {
  const [rows, setRows] = useState<Decision[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await call<Decision[]>(`/api/v1/missions/${mission.id}/decisions`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    }
  }, [mission.id]);
  useEffect(() => {
    load();
  }, [load, mission.status]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      await load();
      await m.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const awardedRobot = m.robots.find((r) => r.id === m.bids.find((b) => b.id === mission.awarded_bid_id)?.robot_id);
  const pending = (rows ?? []).filter((d) => d.run_kind === "recovery" && d.run_status === "AWAITING_APPROVAL" && d.action === "proposed_replacement");

  return (
    <Card title={mission.description} action={<Badge tone="gray">{mission.status.replace(/_/g, " ")}</Badge>} className="mt">
      <div className="row" style={{ marginBottom: 12 }}>
        {mission.status === "published" && (
          <button className="btn violet sm" disabled={busy} onClick={() => act(() => call(`/api/v1/missions/${mission.id}/agent-run`, "POST"))}>
            {busy ? "Running…" : "Run agents"}
          </button>
        )}
        {awardedRobot && (
          <>
            <span className="sub">Awarded to {awardedRobot.name}.</span>
            <button
              className="btn ghost sm"
              disabled={busy}
              onClick={() => {
                act(() => call(`/api/v1/missions/${mission.id}/recovery`, "POST", { failed_robot_id: awardedRobot.id, reason: "battery_low", remaining_fraction: 0.5 }));
              }}
            >
              Inject failure: battery low
            </button>
          </>
        )}
      </div>
      {awardedRobot && <p className="sub">There is no simulator, so failures are injected by hand and labelled as such. Nothing here is detected from telemetry.</p>}
      {err && (
        <div className="form-msg err" role="alert">
          {err}
        </div>
      )}
      {msg && <div className="form-msg ok">{msg}</div>}
      {rows === null ? (
        <Skeleton rows={2} />
      ) : rows.length === 0 ? (
        <Empty icon={BrainCircuit} title="No agent activity yet">{mission.status === "published" ? "Press Run agents to discover robots and negotiate." : "Agents only negotiate on open missions."}</Empty>
      ) : (
        rows.map((d) => (
          <div className="stage" key={d.id}>
            <div className="stage-dot">{d.run_kind === "recovery" ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="spread">
                <strong>
                  {AGENT_LABEL[d.agent] ?? d.agent} · {d.action.replace(/_/g, " ")}
                </strong>
                <EngineTag engine={d.engine} />
              </div>
              <p style={{ color: "var(--text)" }}>{d.explanation}</p>
              <Rounds evidence={d.evidence} />
            </div>
          </div>
        ))
      )}
      {pending.map((d) => (
        <div className="bid-row" key={d.id}>
          <span>Replacement proposal needs your approval: {d.explanation}</span>
          <button className="btn sm" disabled={busy} onClick={() => act(async () => { await call(`/api/v1/missions/${mission.id}/recovery/${d.run_id}/approve`, "POST"); setMsg("Approval recorded in the audit log. Extra payment and dispatch are not implemented."); })}>
            Approve
          </button>
        </div>
      ))}
    </Card>
  );
}

export default function Agents() {
  const m = useMarket();
  const bench = useApi<Benchmarks>("/api/v1/rl/benchmarks");
  const audit = useApi<AuditEntry[]>("/api/v1/audit?limit=25");
  const [focus, setFocus] = useState<string | null>(null);
  useEffect(() => {
    setFocus(new URLSearchParams(window.location.search).get("mission"));
  }, []);

  const missions = m.missions.slice().reverse();
  const ordered = focus ? [...missions.filter((x) => x.id === focus), ...missions.filter((x) => x.id !== focus)] : missions;
  const b = bench.data;
  const rows = b?.results ? Object.entries(b.results) : [];

  return (
    <>
      <PageHeader
        title="AI Intelligence Lab"
        sub="How agents discover, negotiate, review risk and recover. Every decision names its engine, and agents only recommend: you approve and pay."
        action={<Badge tone={m.system?.agents.llm_configured ? "violet" : "amber"}>{m.system?.agents.llm_configured ? "LLM configured: interpretation and explanations" : "No LLM key: rule-based engine"}</Badge>}
      />
      <Card title="What each agent does today">
        <dl className="kv" style={{ gridTemplateColumns: "auto 1fr" }}>
          <dt>Interpreter</dt>
          <dd className="sub" style={{ textAlign: "left" }}>Extracts task, zones and deadline. Rule-based unless an LLM key is set. Output is schema-checked.</dd>
          <dt>Discovery</dt>
          <dd className="sub" style={{ textAlign: "left" }}>Filters by capability and availability. Deterministic.</dd>
          <dt>Negotiation</dt>
          <dd className="sub" style={{ textAlign: "left" }}>Up to 3 rounds of offers and counters. Owner minimum price and buyer budget are hard limits. Deterministic, not an LLM.</dd>
          <dt>Risk</dt>
          <dd className="sub" style={{ textAlign: "left" }}>Flags unverified capability and non-physical sources. No battery, deadline or telemetry checks yet.</dd>
          <dt>Recovery</dt>
          <dd className="sub" style={{ textAlign: "left" }}>After an injected failure, finds a substitute and proposes a revised price for the remaining work. Needs approval.</dd>
          <dt>Not built</dt>
          <dd className="sub" style={{ textAlign: "left" }}>Multi-robot coalitions (OR-Tools), RL-driven decisions in the marketplace, Gazebo-based failure detection.</dd>
        </dl>
      </Card>

      {m.error ? (
        <ErrorState message={m.error} onRetry={m.reload} />
      ) : m.loading ? (
        <Skeleton />
      ) : ordered.length === 0 ? (
        <Card className="mt">
          <Empty icon={BrainCircuit} title="No missions yet">Publish a mission and register robots first.</Empty>
        </Card>
      ) : (
        ordered.map((x) => <Trace key={x.id + x.status} mission={x} m={m} />)
      )}

      <Card title="RL policy benchmark" className="mt" action={<Badge tone="amber">synthetic environment</Badge>}>
        {bench.loading ? (
          <Skeleton rows={2} />
        ) : !b?.available ? (
          <Empty title="No benchmark file">Run python -m services.rl.evaluate.</Empty>
        ) : (
          <>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>Policy</th>
                    <th>Mean net value</th>
                    <th>± std err</th>
                    <th>Failed attempts</th>
                    <th>Episodes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([k, v]) => (
                    <tr key={k}>
                      <td>{k.replace(/_/g, " ")}</td>
                      <td>{v.available === false ? "not trained" : v.mean_net_value}</td>
                      <td>{v.stderr ?? "—"}</td>
                      <td>{v.failed_attempt_rate !== undefined ? `${(v.failed_attempt_rate * 100).toFixed(1)}%` : "—"}</td>
                      <td>{v.episodes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="sub" style={{ marginTop: 10 }}>
              Held-out seeds {b.meta?.eval_seeds}. {b.meta?.dynamics}. {b.meta?.note} The policy is not connected to marketplace decisions.
              {b.meta?.ppo_training && ` PPO: ${b.meta.ppo_training.total_timesteps.toLocaleString()} steps, seed ${b.meta.ppo_training.train_seed}.`}
            </p>
          </>
        )}
      </Card>

      <Card title="Audit log" className="mt">
        {audit.loading ? (
          <Skeleton rows={2} />
        ) : !audit.data?.length ? (
          <Empty title="No events yet">Registrations, awards, PayPal steps and agent decisions are logged here.</Empty>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{new Date(a.at).toLocaleString()}</td>
                    <td>{a.actor}</td>
                    <td>{a.action}</td>
                    <td className="mono">{a.resource.slice(0, 22)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
