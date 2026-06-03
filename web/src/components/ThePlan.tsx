"use client";

import { useEffect, useRef, useState } from "react";
import CircuitSVG from "./CircuitSVG";
import type { OptimiseResponse } from "@/types/api";
import { COMPOUND_CSS, COMPOUND_LABEL } from "@/lib/utils";
import type { Compound } from "@/types/api";

interface Props {
  result: OptimiseResponse;
  circuitPath: string | null;
}

export default function ThePlan({ result, circuitPath }: Props) {
  const rec = result.recommended;
  const pitLaps = rec.pits.map(p => p.lap);

  return (
    <section
      className="relative py-24 px-6 md:px-12 lg:px-20"
      style={{ background: "var(--bg-raised)" }}
      aria-label="Strategy plan"
    >
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="mb-14">
          <span className="kicker">the plan</span>
          <h2
            className="font-display font-700 leading-none"
            style={{
              fontSize: "clamp(2.4rem, 5vw, 4rem)",
              color: "var(--ink)",
            }}
          >
            RACE STRATEGY
          </h2>
        </div>

        {/* Two column: circuit + strategy summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16 items-start">
          {/* Circuit layout */}
          <div>
            {circuitPath ? (
              <div
                className="relative"
                style={{ aspectRatio: "1", maxWidth: "380px" }}
              >
                <CircuitSVG
                  svgPath={circuitPath}
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div
                className="flex items-center justify-center aspect-square max-w-xs rounded-none"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--hairline)",
                  color: "var(--faint)",
                }}
              >
                <span className="eyebrow">No layout data</span>
              </div>
            )}
          </div>

          {/* Strategy summary */}
          <div className="flex flex-col gap-8">
            {/* Stops */}
            <div>
              <span className="eyebrow mb-2 block">Pit stops</span>
              <div className="flex flex-col gap-3">
                {rec.pits.map((pit, i) => (
                  <PitCallout
                    key={i}
                    number={i + 1}
                    lap={pit.lap}
                    compound={pit.compound}
                  />
                ))}
              </div>
            </div>

            {/* Compound sequence */}
            <div>
              <span className="eyebrow mb-3 block">Compound sequence</span>
              <div className="flex items-center gap-3 flex-wrap">
                {rec.stints.map((stint, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex flex-col gap-0.5">
                      <div
                        className="flex items-center gap-2 px-4 py-2"
                        style={{
                          background: "var(--bg-card)",
                          border: `1px solid ${COMPOUND_CSS[stint.compound]}44`,
                        }}
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ background: COMPOUND_CSS[stint.compound] }}
                        />
                        <span
                          className="font-display font-600 text-sm"
                          style={{ color: "var(--ink)" }}
                        >
                          {stint.compound}
                        </span>
                        <span
                          className="font-body text-xs"
                          style={{ color: "var(--muted)" }}
                        >
                          L{stint.start}–{stint.end}
                        </span>
                      </div>
                      <span
                        className="text-xs font-body text-center"
                        style={{ color: "var(--faint)" }}
                      >
                        {stint.laps} laps
                      </span>
                    </div>
                    {i < rec.stints.length - 1 && (
                      <span style={{ color: "var(--faint)" }} aria-hidden>
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* MC risk */}
            <div
              className="p-4"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--hairline)",
              }}
            >
              <span className="eyebrow mb-3 block">Monte Carlo risk band</span>
              <div className="relative h-1.5 rounded-full overflow-hidden mb-2"
                style={{ background: "var(--hairline)" }}
              >
                <div
                  className="absolute h-full rounded-full"
                  style={{
                    background: "var(--accent2)",
                    opacity: 0.4,
                    left: "8%",
                    right: "8%",
                  }}
                />
                <div
                  className="absolute h-full w-0.5 rounded-full"
                  style={{ background: "var(--accent2)", left: "50%" }}
                />
              </div>
              <div
                className="flex justify-between text-xs font-body tabular-nums"
                style={{ color: "var(--faint)" }}
              >
                <span>p10 {(rec.mc.p10 / 60).toFixed(2)} min</span>
                <span
                  className="font-body font-700"
                  style={{ color: "var(--accent2)" }}
                >
                  expected {(rec.mc.mean / 60).toFixed(2)} min
                </span>
                <span>p90 {(rec.mc.p90 / 60).toFixed(2)} min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width stint timeline */}
        <div>
          <span className="eyebrow mb-4 block">Stint timeline</span>
          <StintTimeline stints={rec.stints} totalLaps={result.laps} />
          <div
            className="flex gap-6 mt-4 flex-wrap"
            aria-label="Tyre compound legend"
          >
            {rec.stints
              .filter((s, i, arr) => arr.findIndex(x => x.compound === s.compound) === i)
              .map(s => (
                <div key={s.compound} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: COMPOUND_CSS[s.compound] }}
                    aria-hidden
                  />
                  <span
                    className="font-body text-xs"
                    style={{ color: "var(--muted)" }}
                  >
                    {s.compound}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PitCallout({
  number,
  lap,
  compound,
}: {
  number: number;
  lap: number;
  compound: Compound;
}) {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--hairline)",
      }}
    >
      <span
        className="font-display font-600 text-2xl tabular-nums w-6"
        style={{ color: "var(--accent)" }}
      >
        {number}
      </span>
      <div className="flex flex-col">
        <span
          className="font-display font-600 text-sm"
          style={{ color: "var(--ink)" }}
        >
          Box on Lap {lap}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: COMPOUND_CSS[compound] }}
            aria-hidden
          />
          <span className="font-body text-xs" style={{ color: "var(--muted)" }}>
            Fit {compound}
          </span>
        </div>
      </div>
    </div>
  );
}

function StintTimeline({
  stints,
  totalLaps,
}: {
  stints: OptimiseResponse["recommended"]["stints"];
  totalLaps: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold: 0.4 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full" role="list" aria-label="Race stint timeline">
      <div className="flex h-12 overflow-hidden" style={{ borderRadius: 0 }}>
        {stints.map((stint, i) => {
          const pct = (stint.laps / totalLaps) * 100;
          const color = COMPOUND_CSS[stint.compound];
          const isHard = stint.compound === "HARD";
          const delay = i * 0.08;
          return (
            <div
              key={i}
              role="listitem"
              className="relative h-full flex items-center justify-center overflow-hidden"
              style={{
                width: `${pct}%`,
                background: color,
                opacity: isHard ? 0.85 : 1,
                borderRight: i < stints.length - 1 ? "2px solid var(--bg-raised)" : "none",
                transformOrigin: "left",
                transform: visible ? "scaleX(1)" : "scaleX(0)",
                transition: visible
                  ? `transform 0.7s cubic-bezier(.16,1,.3,1) ${delay}s`
                  : "none",
              }}
              aria-label={`${stint.compound}, laps ${stint.start} to ${stint.end}`}
            >
              {pct > 10 && (
                <span
                  className="font-body font-700 text-xs select-none pointer-events-none"
                  style={{ color: isHard ? "#333" : "#111", opacity: 0.75 }}
                  aria-hidden
                >
                  {COMPOUND_LABEL[stint.compound]} {stint.start}–{stint.end}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Lap labels */}
      <div className="relative mt-1.5" style={{ height: "1.2rem" }}>
        {[...new Set([1, ...stints.map(s => s.end)])].map(lap => {
          const pct = ((lap - 1) / (totalLaps - 1)) * 100;
          return (
            <span
              key={lap}
              className="absolute font-body text-xs tabular-nums"
              style={{
                left: `${pct}%`,
                transform: "translateX(-50%)",
                color: "var(--faint)",
              }}
              aria-hidden
            >
              {lap}
            </span>
          );
        })}
      </div>
    </div>
  );
}
