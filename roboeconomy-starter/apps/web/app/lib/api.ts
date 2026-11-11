"use client";
import { useCallback, useEffect, useState } from "react";

// "/" (set on Vercel) strips to "" = same-origin; undefined falls back to local FastAPI.
export const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export type Capability = "inspection" | "navigation" | "delivery";
export type Source = "simulated" | "physical" | "replay";

export type Robot = {
  id: string;
  name: string;
  owner: string;
  capability: Capability;
  rate_usd: number;
  source: Source;
  status: string;
  model: string | null;
  available: boolean;
  capability_verified: boolean;
};
export type Mission = {
  id: string;
  description: string;
  task_type: Capability;
  budget_usd: number;
  currency: string;
  status: "published" | "payment_pending" | "ready" | string;
  awarded_bid_id: string | null;
  created_at: string | null;
};
export type Bid = { id: string; mission_id: string; robot_id: string; price_usd: number; status: string };
export type Payment = {
  id: string;
  mission_id: string;
  mission: string | null;
  amount_usd: number;
  currency: string;
  status: string;
  paypal_order_id: string | null;
  capture_id: string | null;
  created_at: string | null;
};
export type SystemStatus = {
  database: string;
  paypal: { configured: boolean; environment: string; webhook_configured: boolean };
  simulator: { connected: boolean; detail: string };
  agents: { implemented: boolean };
};

export async function call<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let data: unknown = null;
  try {
    data = await r.json();
  } catch {
    /* non-JSON error body */
  }
  if (!r.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    throw new Error(typeof detail === "string" ? detail : `Request failed (${r.status})`);
  }
  return data as T;
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const reload = useCallback(async () => {
    if (path === null) return;
    try {
      setData(await call<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot reach the API");
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, loading, reload };
}

/** Everything the marketplace screens share, loaded once per page. */
export function useMarket() {
  const robots = useApi<Robot[]>("/api/v1/robots");
  const missions = useApi<Mission[]>("/api/v1/missions");
  const payments = useApi<Payment[]>("/api/v1/payments");
  const system = useApi<SystemStatus>("/api/v1/system");
  const [bids, setBids] = useState<Bid[]>([]);
  const ids = (missions.data ?? []).map((m) => m.id).join(",");
  const loadBids = useCallback(async () => {
    if (!ids) return setBids([]);
    const lists = await Promise.all(ids.split(",").map((id) => call<Bid[]>(`/api/v1/missions/${id}/bids`).catch(() => [])));
    setBids(lists.flat());
  }, [ids]);
  useEffect(() => {
    loadBids();
  }, [loadBids]);
  const reload = useCallback(async () => {
    await Promise.all([robots.reload(), missions.reload(), payments.reload(), system.reload()]);
    await loadBids();
  }, [robots, missions, payments, system, loadBids]);
  const loading = robots.loading || missions.loading;
  const error = robots.error || missions.error;
  return { robots: robots.data ?? [], missions: missions.data ?? [], payments: payments.data ?? [], system: system.data, bids, loading, error, reload };
}

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const statusLabel = (s: string) => s.replace(/_/g, " ");
export const captured = (p: Payment) => p.status === "CAPTURED";
