"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BarChart3, BrainCircuit, Boxes, Crosshair, Home, Menu, Search, Settings, Store, Bot, Wallet, X, type LucideIcon } from "lucide-react";
import { call, useApi, type SystemStatus } from "../lib/api";
import { Badge } from "./ui";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/missions", label: "Missions", icon: Crosshair },
  { href: "/robots", label: "My Robots", icon: Bot },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/agents", label: "AI Agents", icon: BrainCircuit },
  { href: "/simulation", label: "Simulation", icon: Boxes },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const system = useApi<SystemStatus>("/api/v1/system");

  useEffect(() => setOpen(false), [path]);

  // PayPal redirects back to /?checkout=success&token=<order id>. Capture it server-side, then show earnings.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const state = params.get("checkout");
    if (!state) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (state === "cancelled") {
      setBanner({ tone: "err", text: "Checkout cancelled. The mission is still awaiting payment." });
    } else if (state === "success" && token) {
      call<{ status: string }>(`/api/v1/payments/orders/${encodeURIComponent(token)}/capture`, "POST")
        .then((r) => {
          setBanner({ tone: r.status === "CAPTURED" ? "ok" : "err", text: r.status === "CAPTURED" ? "Payment captured by PayPal and recorded." : `Payment status: ${r.status}` });
          router.push("/earnings");
        })
        .catch((e) => setBanner({ tone: "err", text: `Capture failed: ${e.message}` }));
    }
  }, [router]);

  const paypal = system.data?.paypal;
  return (
    <div className="shell">
      <aside className={`side ${open ? "open" : ""}`} aria-label="Main navigation">
        <Link href="/" className="brand">
          <span className="logo" aria-hidden>
            ◈
          </span>
          <span>
            <strong>RoboEconomy</strong>
            <small>Hire. Automate. Earn.</small>
          </span>
        </Link>
        <nav>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
                <Icon size={18} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="side-status">
          <div className="side-status-title">System</div>
          <Row label="API" ok={!system.error && !system.loading} text={system.error ? "offline" : system.loading ? "…" : "online"} />
          <Row label="Database" ok={!!system.data} text={system.data?.database ?? "—"} />
          <Row label="PayPal" ok={!!paypal?.configured} text={paypal ? (paypal.configured ? paypal.environment : "not configured") : "—"} />
          <Row label="Simulator" ok={!!system.data?.simulator.connected} text={system.data?.simulator.connected ? "connected" : "not connected"} />
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="top">
          <button className="icon-btn menu" onClick={() => setOpen(!open)} aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/marketplace?q=${encodeURIComponent(q)}`);
            }}
          >
            <Search size={16} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search robots by name, owner or capability" aria-label="Search robots" />
          </form>
          {paypal && (
            <Link href="/settings" className="paypal-pill" title="PayPal connection status">
              <Badge tone={paypal.configured ? "green" : "amber"}>PayPal {paypal.environment}: {paypal.configured ? "keys configured" : "not configured"}</Badge>
            </Link>
          )}
        </header>
        {banner && (
          <div className={`banner ${banner.tone}`} role="status">
            {banner.text}
            <button className="icon-btn" onClick={() => setBanner(null)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        )}
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function Row({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div className="side-row">
      <span>{label}</span>
      <span className={ok ? "ok" : "off"}>
        <i /> {text}
      </span>
    </div>
  );
}
