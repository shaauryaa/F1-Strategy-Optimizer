"use client";

import { useState } from "react";
import type { OptimiseResponse, Compound } from "@/types/api";
import { COMPOUND_CSS, COMPOUND_LABEL, isSameStrategy } from "@/lib/utils";

interface Props {
  result: OptimiseResponse;
}

interface StrategyCompareData {
  id: string;
  isRec: boolean;
  sequence: Compound[];
  stints: { compound: Compound; start: number; end: number; laps: number }[];
  totalMin: number;
  stops: number;
  delta: number;
}

function deriveStints(
  sequence: Compound[],
  pits: { lap: number }[],
  totalLaps: number
): { compound: Compound; start: number; end: number; laps: number }[] {
  return sequence.map((compound, i) => {
    const start = i === 0 ? 1 : pits[i - 1].lap;
    const end = i < pits.length ? pits[i].lap - 1 : totalLaps;
    return { compound, start, end, laps: end - start + 1 };
  });
}

export default function TheRoadNotTaken({ result }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const rec = result.recommended;
  const alts = result.alternatives.filter(a => !isSameStrategy(a, rec));
  const undercut = result.undercut;

  function toggle(id: string) {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length < 2) return [...prev, id];
      return [prev[1], id]; // shift out oldest when at capacity
    });
  }

  const allStrategyData: StrategyCompareData[] = [
    {
      id: "rec",
      isRec: true,
      sequence: [rec.start_compound, ...rec.pits.map(p => p.compound)],
      stints: rec.stints,
      totalMin: rec.total_min,
      stops: rec.stops,
      delta: 0,
    },
    ...alts.map((alt, i) => ({
      id: `alt-${i}`,
      isRec: false,
      sequence: alt.sequence,
      stints: deriveStints(alt.sequence, alt.pits, result.laps),
      totalMin: alt.total_s / 60,
      stops: alt.pits.length,
      delta: alt.delta_s,
    })),
  ];

  const compareData = selected
    .map(id => allStrategyData.find(s => s.id === id))
    .filter((s): s is StrategyCompareData => s !== undefined);

  return (
    <section
      className="py-24 px-6 md:px-12 lg:px-20"
      style={{ background: "var(--bg-raised)" }}
      aria-label="Alternative strategies"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-14">
          <span className="kicker">alternatives</span>
          <h2
            className="font-display font-700 leading-none"
            style={{
              fontSize: "clamp(2.4rem, 5vw, 4rem)",
              color: "var(--ink)",
            }}
          >
            THE ROAD NOT TAKEN
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Ranked strategies list */}
          <div>
            <span className="eyebrow mb-6 block">Ranked strategies</span>

            <StrategyRow
              sequence={[rec.start_compound, ...rec.pits.map(p => p.compound)]}
              pits={rec.pits}
              totalMin={rec.total_min}
              delta={0}
              isChosen
              isSelected={selected.includes("rec")}
              onToggle={() => toggle("rec")}
            />

            <div
              className="my-2 h-px"
              style={{ background: "var(--hairline)" }}
              aria-hidden
            />

            {alts.length === 0 ? (
              <p
                className="font-body text-sm py-4"
                style={{ color: "var(--muted)" }}
              >
                No alternatives within search range
              </p>
            ) : (
              alts.map((alt, i) => (
                <StrategyRow
                  key={i}
                  sequence={alt.sequence}
                  pits={alt.pits}
                  totalMin={alt.total_s / 60}
                  delta={alt.delta_s}
                  isChosen={false}
                  isSelected={selected.includes(`alt-${i}`)}
                  onToggle={() => toggle(`alt-${i}`)}
                />
              ))
            )}
          </div>

          {/* Undercut analysis */}
          {undercut.length > 0 && (
            <div>
              <span className="eyebrow mb-6 block">Undercut check</span>
              <div className="flex flex-col gap-3">
                {undercut.map((row, i) => {
                  const underFav = row["undercut(-1)"] < 0;
                  const overFav = row["overcut(+1)"] < 0;
                  return (
                    <div
                      key={i}
                      className="p-4"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--hairline)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-display font-600 text-sm"
                            style={{ color: "var(--accent)" }}
                          >
                            Stop {row.pit}
                          </span>
                          <span
                            className="font-body text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            Lap {row.lap}
                          </span>
                          <CompoundDot compound={row.compound} />
                          <span
                            className="font-body text-xs"
                            style={{ color: "var(--muted)" }}
                          >
                            {row.compound}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <VerdictBlock
                          label="Box one lap early"
                          delta={row["undercut(-1)"]}
                          favorable={underFav}
                        />
                        <VerdictBlock
                          label="Box one lap late"
                          delta={row["overcut(+1)"]}
                          favorable={overFav}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Side-by-side comparison panel — appears when exactly 2 strategies are selected */}
        {compareData.length === 2 && (
          <ComparePanel strategies={compareData} />
        )}
      </div>
    </section>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function CompoundDot({ compound }: { compound: Compound }) {
  return (
    <span
      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ background: COMPOUND_CSS[compound] }}
      aria-hidden
    />
  );
}

function StrategyRow({
  sequence,
  pits,
  totalMin,
  delta,
  isChosen,
  isSelected,
  onToggle,
}: {
  sequence: Compound[];
  pits: { lap: number; compound: Compound }[];
  totalMin: number;
  delta: number;
  isChosen: boolean;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="flex items-center gap-3 py-3 px-4"
      style={{
        background: isChosen ? "rgba(52,224,230,0.04)" : "transparent",
        border: isChosen ? "1px solid rgba(52,224,230,0.18)" : "1px solid transparent",
        borderBottom: !isChosen ? "1px solid var(--hairline)" : undefined,
      }}
    >
      {/* Sequence dots + pit lap labels */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
        {isChosen && (
          <span
            className="font-script text-sm mr-1"
            style={{ fontSize: "0.85rem" }}
          >
            chosen
          </span>
        )}
        {sequence.map((c, i) => (
          <div key={i} className="flex items-center gap-1">
            <CompoundDot compound={c} />
            <span
              className="font-body text-xs font-700"
              style={{ color: COMPOUND_CSS[c] }}
            >
              {c[0]}
            </span>
            {i < sequence.length - 1 && (
              <span
                className="font-body text-xs mx-0.5"
                style={{ color: "var(--faint)" }}
                aria-hidden
              >
                ›
              </span>
            )}
          </div>
        ))}
        {pits.length > 0 && (
          <span
            className="font-body text-xs ml-1"
            style={{ color: "var(--faint)" }}
          >
            {pits.map(p => `L${p.lap}`).join(", ")}
          </span>
        )}
      </div>

      {/* Total time */}
      <span
        className="font-body font-700 text-sm tabular-nums flex-shrink-0"
        style={{ color: "var(--muted)" }}
      >
        {totalMin.toFixed(2)} min
      </span>

      {/* Delta vs optimal */}
      <span
        className="font-body font-700 text-sm tabular-nums w-16 text-right flex-shrink-0"
        style={{
          color: isChosen
            ? "var(--accent2)"
            : delta > 0
            ? "var(--faint)"
            : "var(--ink)",
        }}
      >
        {isChosen ? "—" : delta > 0 ? `+${delta.toFixed(1)}s` : `${delta.toFixed(1)}s`}
      </span>

      {/* Compare toggle button */}
      <button
        onClick={onToggle}
        aria-pressed={isSelected}
        aria-label={isSelected ? "Remove from comparison" : "Add to comparison"}
        style={{
          flexShrink: 0,
          padding: "3px 10px",
          fontSize: "0.6rem",
          fontFamily: "var(--font-body)",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          border: isSelected
            ? "1px solid var(--accent2)"
            : "1px solid var(--faint)",
          background: isSelected ? "rgba(196,255,0,0.08)" : "transparent",
          color: isSelected ? "var(--accent2)" : "var(--faint)",
          cursor: "pointer",
          lineHeight: 1.6,
          transition: "color 0.15s, border-color 0.15s, background 0.15s",
        }}
      >
        {isSelected ? "✕" : "Compare"}
      </button>
    </div>
  );
}

// ─── Comparison panel ─────────────────────────────────────────────────────────

function ComparePanel({ strategies }: { strategies: StrategyCompareData[] }) {
  const [a, b] = strategies;
  return (
    <div className="mt-12 pt-10" style={{ borderTop: "1px solid var(--hairline)" }}>
      <span className="eyebrow mb-6 block">Side-by-side comparison</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <CompareCard strategy={a} />
        <CompareCard strategy={b} />
      </div>
    </div>
  );
}

function CompareCard({ strategy }: { strategy: StrategyCompareData }) {
  return (
    <div
      className="p-5 flex flex-col gap-5"
      style={{
        background: "var(--bg-card)",
        border: strategy.isRec
          ? "1px solid rgba(196,255,0,0.22)"
          : "1px solid var(--hairline)",
      }}
    >
      {/* Header: label + compound sequence */}
      <div>
        {strategy.isRec && (
          <span className="font-script block mb-1" style={{ fontSize: "0.9rem" }}>
            Recommended
          </span>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          {strategy.sequence.map((c, i) => (
            <div key={i} className="flex items-center gap-1">
              <CompoundDot compound={c} />
              <span
                className="font-body text-xs font-700"
                style={{ color: COMPOUND_CSS[c] }}
              >
                {COMPOUND_LABEL[c]}
              </span>
              {i < strategy.sequence.length - 1 && (
                <span
                  className="font-body text-xs mx-0.5"
                  style={{ color: "var(--faint)" }}
                  aria-hidden
                >
                  ›
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stint breakdown */}
      <div>
        <span className="eyebrow mb-3 block">Stints</span>
        <div className="flex flex-col gap-2">
          {strategy.stints.map((st, i) => (
            <div key={i} className="flex items-center gap-3">
              <CompoundDot compound={st.compound} />
              <span
                className="font-body text-xs font-700"
                style={{ color: COMPOUND_CSS[st.compound], minWidth: "1.2rem" }}
              >
                {COMPOUND_LABEL[st.compound]}
              </span>
              <span
                className="font-body text-xs tabular-nums"
                style={{ color: "var(--muted)" }}
              >
                L{st.start}–L{st.end}
              </span>
              <span
                className="font-body text-xs tabular-nums"
                style={{ color: "var(--faint)" }}
              >
                {st.laps} laps
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-3 gap-3 pt-4"
        style={{ borderTop: "1px solid var(--hairline)" }}
      >
        <div>
          <span className="eyebrow block mb-1" style={{ fontSize: "0.6rem" }}>
            Total time
          </span>
          <span
            className="font-display font-600 text-sm tabular-nums"
            style={{ color: "var(--ink)" }}
          >
            {strategy.totalMin.toFixed(2)}
            <span className="font-body text-xs" style={{ color: "var(--faint)" }}> min</span>
          </span>
        </div>
        <div>
          <span className="eyebrow block mb-1" style={{ fontSize: "0.6rem" }}>
            Stops
          </span>
          <span
            className="font-display font-600 text-sm"
            style={{ color: "var(--ink)" }}
          >
            {strategy.stops}
          </span>
        </div>
        <div>
          <span className="eyebrow block mb-1" style={{ fontSize: "0.6rem" }}>
            vs Optimal
          </span>
          <span
            className="font-display font-600 text-sm tabular-nums"
            style={{ color: strategy.isRec ? "var(--accent2)" : "var(--muted)" }}
          >
            {strategy.isRec ? "—" : `+${strategy.delta.toFixed(1)}s`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Undercut verdict block ───────────────────────────────────────────────────

function VerdictBlock({
  label,
  delta,
  favorable,
}: {
  label: string;
  delta: number;
  favorable: boolean;
}) {
  const sign = delta > 0 ? "+" : "";
  const isGood = delta < 0;
  const isBad  = delta > 0;

  return (
    <div
      className="p-3"
      style={{
        background: isGood
          ? "rgba(52,224,230,0.06)"
          : isBad
          ? "rgba(255,24,1,0.06)"
          : "var(--bg-raised)",
        border: `1px solid ${
          isGood
            ? "rgba(52,224,230,0.2)"
            : isBad
            ? "rgba(255,24,1,0.22)"
            : "var(--hairline)"
        }`,
      }}
    >
      <span
        className="font-body text-xs block mb-1"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </span>
      <span
        className="font-display font-600 text-lg tabular-nums"
        style={{
          color: isGood
            ? "var(--accent2)"
            : isBad
            ? "var(--accent)"
            : "var(--faint)",
        }}
      >
        {sign}{delta.toFixed(1)}s
      </span>
      <span
        className="font-body text-xs block mt-0.5"
        style={{ color: "var(--faint)" }}
      >
        {favorable ? "saves time" : "costs time"}
      </span>
    </div>
  );
}
