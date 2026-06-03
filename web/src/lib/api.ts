import type { Circuit, ModelCard, OptimiseRequest, OptimiseResponse } from "@/types/api";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchCircuits = () => get<Circuit[]>("/circuits");
export const fetchModelCard = () => get<ModelCard>("/model-card");

export async function postOptimise(req: OptimiseRequest): Promise<OptimiseResponse> {
  const res = await fetch(`${BASE}/optimise`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { detail?: string };
    throw new Error(err.detail ?? `Optimise failed with status ${res.status}`);
  }
  return res.json() as Promise<OptimiseResponse>;
}
