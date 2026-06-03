"use client";

import { useEffect, useRef, useState } from "react";
import type { Circuit, OptimiseResponse } from "@/types/api";
import { buildPaceSVGPath, fmtMinSec } from "@/lib/utils";

interface Props {
  circuits: Circuit[];
  selectedSlug: string;
  onCircuitChange: (slug: string) => void;
  result: OptimiseResponse | null;
  loading: boolean;
  loadingPhase: "optimising" | "cold" | "";
  gpName: string;
  onConfigOpen: () => void;
}

export default function Hero({
  circuits,
  selectedSlug,
  onCircuitChange,
  result,
  loading,
  loadingPhase,
  gpName,
  onConfigOpen,
}: Props) {
  const circuit = circuits.find(c => c.slug === selectedSlug);
  const paceSvgRef = useRef<SVGPathElement>(null);
  const [pathD, setPathD] = useState("");
  const [pathLen, setPathLen] = useState(3000);

  useEffect(() => {
    if (!result) return;
    const { d, length } = buildPaceSVGPath(
      result.pace_curve.recommended_lap,
      800,
      180,
      12
    );
    setPathD(d);
    setPathLen(length || 3000);
  }, [result]);

  useEffect(() => {
    if (!paceSvgRef.current || !pathD) return;
    const el = paceSvgRef.current;
    const len = el.getTotalLength?.() || pathLen;
    el.style.setProperty("--pace-len", String(Math.ceil(len)));
    el.style.strokeDasharray = String(Math.ceil(len));
    el.style.strokeDashoffset = String(Math.ceil(len));
    const frame = requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 2.2s cubic-bezier(.16,1,.3,1) 0.3s";
      el.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(frame);
  }, [pathD, pathLen]);

  const rec = result?.recommended;

  return (
    <section
      className="relative min-h-screen flex flex-col overflow-hidden"
      style={{ background: "var(--bg)" }}
      aria-label="PITWALL hero"
    >
      {/* Ambient red glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 80%, rgba(255,24,1,0.09) 0%, transparent 70%)",
        }}
      />

      {/* Top bar: logo | circuit select | configure — three distinct zones */}
      <header className="relative z-10 grid grid-cols-3 items-center px-6 md:px-12 pt-6 pb-4 gap-4">
        {/* Left: brand */}
        <div className="flex items-center gap-3">
          <span
            className="font-display text-xl tracking-tight"
            style={{ color: "var(--ink)", fontWeight: 700 }}
          >
            PITWALL
          </span>
          <span
            className="hidden sm:block h-4 w-px"
            style={{ background: "var(--hairline)" }}
          />
          <span className="hidden sm:block eyebrow">Strategy Engine</span>
        </div>

        {/* Center: circuit switcher */}
        <div className="relative flex justify-center">
          <div className="relative">
            <select
              value={selectedSlug}
              onChange={e => onCircuitChange(e.target.value)}
              aria-label="Select circuit"
              className="appearance-none pr-7 pl-3 py-1.5 text-sm font-body rounded-none focus:outline-none cursor-pointer"
              style={{
                background: "var(--bg-raised)",
                border: `1px solid ${selectedSlug ? "var(--hairline)" : "var(--accent2)"}`,
                color: selectedSlug ? "var(--ink)" : "var(--accent2)",
                fontFamily: "var(--font-body)",
              }}
            >
              <option value="" disabled>Select a circuit</option>
              {circuits.map(c => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
            <span
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: "var(--muted)" }}
              aria-hidden
            >
              ▾
            </span>
          </div>
        </div>

        {/* Right: configure button */}
        <div className="flex justify-end">
          <button
            onClick={onConfigOpen}
            className="flex items-center gap-2 px-4 py-1.5 text-sm font-body transition-opacity hover:opacity-75 focus:outline-none focus-visible:ring-1"
            style={{
              background: "var(--bg-raised)",
              border: "1px solid var(--hairline)",
              color: "var(--ink)",
              fontFamily: "var(--font-body)",
            }}
            aria-label="Open race configuration"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <circle cx="6.5" cy="6.5" r="2.2" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M6.5 1v1.5M6.5 10.5V12M1 6.5h1.5M10.5 6.5H12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
            Configure
          </button>
        </div>
      </header>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        {/* Eyebrow — only when a circuit is chosen */}
        {circuit && (
          <span className="eyebrow mb-3">{circuit.name}</span>
        )}

        {/* Circuit name — Clash Display */}
        <h1
          className="font-display leading-none tracking-tight mb-2"
          style={{
            fontSize: circuit ? "clamp(3rem, 8vw, 7rem)" : "clamp(2rem, 5vw, 4rem)",
            color: circuit ? "var(--ink)" : "var(--faint)",
            fontWeight: 700,
          }}
        >
          {circuit ? circuit.name.toUpperCase() : "SELECT A CIRCUIT"}
        </h1>

        {/* Grand Prix name — Kaushan script, accent2 */}
        <p
          className="font-script mb-8"
          style={{ fontSize: "clamp(1.4rem, 3vw, 2.2rem)" }}
        >
          {circuit ? (gpName || " ") : ""}
        </p>

        {/* Readout row */}
        {rec ? (
          <div
            className="flex flex-wrap justify-center gap-6 md:gap-10 mb-10 font-body"
            style={{ color: "var(--muted)" }}
          >
            <ReadoutItem
              label="Projected time"
              value={fmtMinSec(rec.total_s)}
              highlight
            />
            <ReadoutItem
              label="Pit stops"
              value={String(rec.stops)}
            />
            <ReadoutItem
              label="Laps"
              value={String(result!.laps)}
            />
            <ReadoutItem
              label="Track temp"
              value={`${result!.temp}°C`}
            />
          </div>
        ) : !loading ? (
          <p
            className="mb-10 font-body text-sm"
            style={{ color: "var(--muted)" }}
          >
            Configure and optimise to see the strategy
          </p>
        ) : loadingPhase === "cold" ? (
          <div className="mb-10 flex flex-col items-center gap-3 text-center px-4">
            <LoadingPulse />
            <span
              className="font-body text-sm tracking-wide cold-pulse"
              style={{ color: "var(--accent2)", maxWidth: 340 }}
            >
              Waking up the server, this may take ~30 seconds on first load…
            </span>
          </div>
        ) : (
          <div className="mb-10 flex items-center gap-3" style={{ color: "var(--muted)" }}>
            <LoadingPulse />
            <span className="font-body text-sm tracking-wide">Optimising strategy…</span>
          </div>
        )}

        {/* Pace line SVG */}
        <div
          className="w-full max-w-3xl mx-auto"
          style={{ height: "120px" }}
          aria-hidden
        >
          <svg
            viewBox="0 0 800 180"
            preserveAspectRatio="none"
            className="w-full h-full"
            style={{ overflow: "visible" }}
          >
            {/* Edge fade masks */}
            <defs>
              <linearGradient id="fade-x" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--bg)" stopOpacity="1" />
                <stop offset="8%" stopColor="var(--bg)" stopOpacity="0" />
                <stop offset="92%" stopColor="var(--bg)" stopOpacity="0" />
                <stop offset="100%" stopColor="var(--bg)" stopOpacity="1" />
              </linearGradient>
              <mask id="fade-mask">
                <rect x="0" y="0" width="800" height="180" fill="url(#fade-x)" />
              </mask>
            </defs>
            <g mask="url(#fade-mask)">
              {pathD && (
                <path
                  ref={paceSvgRef}
                  d={pathD}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {!pathD && (
                <line
                  x1="50" y1="90" x2="750" y2="90"
                  stroke="var(--hairline)"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                />
              )}
            </g>
          </svg>
        </div>
      </div>

      {/* Scroll hint */}
      <div
        className="relative z-10 flex justify-center pb-8"
        aria-hidden
      >
        <div
          className="flex flex-col items-center gap-1.5"
          style={{ color: "var(--faint)" }}
        >
          <span className="eyebrow text-xs tracking-widest" style={{ color: "var(--faint)" }}>
            scroll
          </span>
          <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
            <rect x="1" y="1" width="12" height="18" rx="6" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="6" y="4" width="2" height="4" rx="1" fill="currentColor">
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; 0 4; 0 0"
                dur="2s"
                repeatCount="indefinite"
              />
            </rect>
          </svg>
        </div>
      </div>
    </section>
  );
}

function ReadoutItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="eyebrow" style={{ color: "var(--faint)" }}>
        {label}
      </span>
      <span
        className="font-display font-600 text-2xl count-up tabular-nums"
        style={{ color: highlight ? "var(--ink)" : "var(--muted)" }}
      >
        {value}
      </span>
    </div>
  );
}

function LoadingPulse() {
  return (
    <div className="flex gap-1.5" aria-hidden>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className="w-1 h-1 rounded-full"
          style={{
            background: "var(--accent)",
            animation: `pulse 1s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
