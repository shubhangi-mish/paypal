"use client";
import { API, useApi, type SystemStatus } from "../lib/api";
import { Badge, Card, ErrorState, PageHeader, Skeleton } from "../components/ui";

export default function Settings() {
  const { data, error, loading, reload } = useApi<SystemStatus>("/api/v1/system");
  return (
    <>
      <PageHeader title="Settings" sub="Read-only status of this deployment. Secrets are never shown." />
      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading || !data ? (
        <Skeleton rows={3} />
      ) : (
        <div className="grid g2">
          <Card title="PayPal">
            <dl className="kv">
              <dt>Environment</dt>
              <dd>
                <Badge tone={data.paypal.environment === "sandbox" ? "violet" : "amber"}>{data.paypal.environment}</Badge>
              </dd>
              <dt>API credentials</dt>
              <dd>
                <Badge tone={data.paypal.configured ? "green" : "red"}>{data.paypal.configured ? "configured" : "missing"}</Badge>
              </dd>
              <dt>Webhook ID</dt>
              <dd>
                <Badge tone={data.paypal.webhook_configured ? "green" : "amber"}>{data.paypal.webhook_configured ? "configured" : "missing"}</Badge>
              </dd>
            </dl>
            <p className="sub" style={{ marginTop: 12 }}>
              Configuration only. Whether a webhook has actually been delivered is not tracked on this screen.
            </p>
          </Card>
          <Card title="Platform">
            <dl className="kv">
              <dt>Database</dt>
              <dd>{data.database}</dd>
              <dt>API base</dt>
              <dd className="mono">{API || "same origin"}</dd>
              <dt>Simulator</dt>
              <dd>
                <Badge tone={data.simulator.connected ? "green" : "amber"}>{data.simulator.connected ? "connected" : "not connected"}</Badge>
              </dd>
              <dt>Autonomous agents</dt>
              <dd>
                <Badge tone={data.agents.implemented ? "green" : "gray"}>{data.agents.implemented ? "running" : "not implemented"}</Badge>
              </dd>
            </dl>
          </Card>
        </div>
      )}
    </>
  );
}
