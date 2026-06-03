import type { Circuit, ModelCard, OptimiseRequest, OptimiseResponse } from "@/types/api";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchCircuits = () => get<Circuit[]>("/circuits");
export const fetchModelCard = () => get<ModelCard>("/model-card");

/** Wake the Render free-tier instance before the heavy optimise call. */
async function warmUp(): Promise<void> {
  try {
    await fetch(`${BASE}/health`, { cache: "no-store" });
  } catch {
    // ignore — we'll surface any real error from the optimise call itself
  }
}

export async function postOptimise(
  req: OptimiseRequest,
  onWaking?: () => void,
): Promise<OptimiseResponse> {
  // Ping health to wake the dyno; if it's cold the optimise call needs the time.
  onWaking?.();
  await warmUp();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);

  try {
    const res = await fetch(`${BASE}/optimise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      let msg = `API error ${res.status}`;
      try { msg = (JSON.parse(body) as { detail?: string; error?: string }).detail ?? (JSON.parse(body) as { error?: string }).error ?? msg; } catch { /* */ }
      throw new Error(msg);
    }
    return res.json() as Promise<OptimiseResponse>;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError")
      throw new Error("Request timed out after 90 s — Render may still be waking up, try again");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
