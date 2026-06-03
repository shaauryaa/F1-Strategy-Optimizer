"use client";

import type { OptimiseResponse } from "@/types/api";
import { COMPOUND_CSS, isSameStrategy } from "@/lib/utils";
import type { Compound } from "@/types/api";

interface Props {
  result: OptimiseResponse;
}

export default function TheRoadNotTaken({ result }: Props) {
  const rec = result.recommended;

  // Dedupe: filter out any alternative that is identical to the recommendation
  const alts = result.alternatives.filter(a => !isSameStrategy(a, rec));

  const undercut = result.undercut;

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
          {/* Alternatives list */}
          <div>
            <span className="eyebrow mb-6 block">Ranked strategies</span>

            {/* Chosen (recommended) always shown first */}
            <StrategyRow
              sequence={[rec.start_compound, ...rec.pits.map(p => p.compound)]}
              pits={rec.pits}
              totalMin={rec.total_min}
              delta={0}
              isChosen
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
      </div>
    </section>
  );
}

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
}: {
  sequence: Compound[];
  pits: { lap: number; compound: Compound }[];
  totalMin: number;
  delta: number;
  isChosen: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3 px-4"
      style={{
        background: isChosen ? "rgba(52,224,230,0.04)" : "transparent",
        border: isChosen ? "1px solid rgba(52,224,230,0.18)" : "1px solid transparent",
        borderBottom: !isChosen ? `1px solid var(--hairline)` : undefined,
      }}
    >
      {/* Sequence dots + lap labels */}
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

      {/* Time */}
      <span
        className="font-body font-700 text-sm tabular-nums flex-shrink-0"
        style={{ color: "var(--muted)" }}
      >
        {totalMin.toFixed(2)} min
      </span>

      {/* Delta */}
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
        {isChosen ? "chosen" : delta > 0 ? `+${delta.toFixed(1)}s` : `${delta.toFixed(1)}s`}
      </span>
    </div>
  );
}

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
  return (
    <div
      className="p-3"
      style={{
        background: favorable ? "rgba(52,224,230,0.06)" : "var(--bg-raised)",
        border: `1px solid ${favorable ? "rgba(52,224,230,0.2)" : "var(--hairline)"}`,
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
        style={{ color: favorable ? "var(--accent2)" : "var(--faint)" }}
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
