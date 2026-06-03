import type { Compound, Alternative, Recommended } from "@/types/api";

export const COMPOUND_CSS: Record<Compound, string> = {
  SOFT:   "var(--soft)",
  MEDIUM: "var(--medium)",
  HARD:   "var(--hard)",
};

export const COMPOUND_LABEL: Record<Compound, string> = {
  SOFT: "S", MEDIUM: "M", HARD: "H",
};

export function fmtLapTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(3).padStart(6, "0");
  return `${m}:${sec}`;
}

export function fmtMinSec(totalS: number): string {
  const m = Math.floor(totalS / 60);
  const s = Math.round(totalS % 60);
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/** Build a compact SVG path for the pace curve (normalized to viewBox 0 0 W H). */
export function buildPaceSVGPath(
  lapTimes: number[],
  width: number,
  height: number,
  pad = 0
): { d: string; length: number } {
  const vals = lapTimes.filter(Boolean);
  if (vals.length === 0) return { d: "", length: 0 };
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const rangeV = maxV - minV || 1;
  const n = lapTimes.length;
  const pts = lapTimes.map((v, i) => {
    const x = pad + (i / (n - 1)) * (width - 2 * pad);
    const y = pad + (1 - (v - minV) / rangeV) * (height - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return { d: `M ${pts.join(" L ")}`, length: n * 20 };
}

/** Return true if two strategies are identical (same sequence + same pit laps). */
export function isSameStrategy(a: Alternative, rec: Recommended): boolean {
  const aSeq = a.sequence.join(",");
  const rSeq = [rec.start_compound, ...rec.pits.map(p => p.compound)].join(",");
  if (aSeq !== rSeq) return false;
  const aLaps = a.pits.map(p => p.lap).join(",");
  const rLaps = rec.pits.map(p => p.lap).join(",");
  return aLaps === rLaps;
}
