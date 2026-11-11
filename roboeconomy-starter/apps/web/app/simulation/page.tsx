"use client";
import { Boxes } from "lucide-react";
import { Badge, Card, Empty, MissionStatus, PageHeader, RobotAvatar } from "../components/ui";
import { useMarket, usd } from "../lib/api";

const TELEMETRY = ["Mission progress", "Battery", "Robot health", "Task status", "Pose"];

export default function Simulation() {
  const m = useMarket();
  const connected = !!m.system?.simulator.connected;
  const ready = m.missions.filter((x) => x.status === "ready");

  return (
    <>
      <PageHeader title="Mission Control" sub="Live Gazebo/ROS2 telemetry. This screen draws nothing that the simulator did not send." action={<Badge tone={connected ? "green" : "amber"}>{connected ? "Simulator connected" : "No simulator connected"}</Badge>} />
      <div className="grid split">
        <div className="canvas" role="img" aria-label="Simulation canvas: no telemetry received">
          <Empty icon={Boxes} title="Waiting for simulator telemetry">
            {m.system?.simulator.detail ?? "Checking simulator status…"} Robot positions will be drawn here only from timestamped Gazebo odometry once ingestion is built.
          </Empty>
        </div>
        <div className="grid" style={{ alignContent: "start" }}>
          <Card title="Telemetry">
            <dl className="kv">
              {TELEMETRY.map((t) => (
                <div key={t} style={{ display: "contents" }}>
                  <dt>{t}</dt>
                  <dd className="sub">No data</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card title="Ready for dispatch">
            {ready.length === 0 ? (
              <Empty title="Nothing paid yet">Missions appear here after PayPal captures their payment.</Empty>
            ) : (
              <div className="list">
                {ready.map((x) => (
                  <div className="list-item" key={x.id}>
                    <div className="row">
                      <RobotAvatar capability={x.task_type} size={34} />
                      <div style={{ minWidth: 0 }}>
                        <strong>{x.description}</strong>
                        <span className="sub">{usd(x.budget_usd)}</span>
                      </div>
                    </div>
                    <div className="row" style={{ marginTop: 8 }}>
                      <MissionStatus status={x.status} />
                      <Badge tone="gray">dispatch not implemented</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      <Card title="Mission timeline" className="mt">
        <Empty title="No timeline events">Task start, waypoint and completion events will list here when the simulator reports them.</Empty>
      </Card>
    </>
  );
}
