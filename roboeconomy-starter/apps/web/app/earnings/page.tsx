"use client";
import { Wallet } from "lucide-react";
import { BarChart, Badge, Card, Empty, ErrorState, MissionStatus, PageHeader, Skeleton, Stat } from "../components/ui";
import { captured, useMarket, usd } from "../lib/api";

export default function Earnings() {
  const m = useMarket();
  const confirmed = m.payments.filter(captured);
  const confirmedTotal = confirmed.reduce((s, p) => s + p.amount_usd, 0);
  const pendingTotal = m.payments.filter((p) => !captured(p)).reduce((s, p) => s + p.amount_usd, 0);
  // Awarded missions that have no PayPal order yet still represent expected revenue.
  const unordered = m.missions
    .filter((x) => x.status === "payment_pending" && !m.payments.some((p) => p.mission_id === x.id))
    .reduce((s, x) => s + (m.bids.find((b) => b.id === x.awarded_bid_id)?.price_usd ?? 0), 0);
  const estimated = confirmedTotal + pendingTotal + unordered;

  return (
    <>
      <PageHeader title="Earnings" sub="Only PayPal-captured payments count as confirmed. Everything else is an estimate." />
      {m.error ? (
        <ErrorState message={m.error} onRetry={m.reload} />
      ) : (
        <>
          <div className="grid g4">
            <Stat icon={Wallet} label="Confirmed" value={m.loading ? "…" : usd(confirmedTotal)} hint="captured by PayPal" />
            <Stat label="Estimated revenue" value={m.loading ? "…" : usd(estimated)} hint="confirmed + awarded but unpaid" />
            <Stat label="Operating costs" value="Not tracked" hint="no cost data is collected yet" />
            <Stat label="Net earnings" value={m.loading ? "…" : usd(confirmedTotal)} hint="confirmed, before unknown costs" />
          </div>

          <div className="grid split mt">
            <Card title="Confirmed payments">
              {confirmed.length === 0 ? (
                <Empty icon={Wallet} title="No captured payments yet">A payment shows here only after PayPal reports it as captured.</Empty>
              ) : (
                <BarChart label="Captured payment amounts in USD" data={confirmed.map((p, i) => ({ label: `#${i + 1}`, value: p.amount_usd }))} />
              )}
            </Card>
            <Card title="Mission history">
              {m.loading ? (
                <Skeleton />
              ) : m.missions.length === 0 ? (
                <Empty title="No missions yet" />
              ) : (
                <div className="list">
                  {m.missions
                    .slice()
                    .reverse()
                    .map((x) => (
                      <div className="list-item" key={x.id}>
                        <div className="spread">
                          <strong style={{ minWidth: 0 }}>{x.description}</strong>
                          <MissionStatus status={x.status} />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>

          <Card title="PayPal transactions" className="mt">
            {m.payments.length === 0 ? (
              <Empty title="No PayPal orders yet">Orders are created when you press Pay on an awarded mission.</Empty>
            ) : (
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mission</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Order ID</th>
                      <th>Capture ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{p.mission ?? p.mission_id}</td>
                        <td>{usd(p.amount_usd)}</td>
                        <td>
                          <Badge tone={captured(p) ? "green" : "amber"}>{p.status.replace(/_/g, " ").toLowerCase()}</Badge>
                        </td>
                        <td className="mono">{p.paypal_order_id ?? "—"}</td>
                        <td className="mono">{p.capture_id ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="sub" style={{ marginTop: 10 }}>
              PayPal environment: {m.system?.paypal.environment ?? "—"}. Sandbox payments are test money.
            </p>
          </Card>
        </>
      )}
    </>
  );
}
