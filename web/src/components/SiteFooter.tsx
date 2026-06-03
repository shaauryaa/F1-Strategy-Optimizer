import type { ModelCard } from "@/types/api";

interface Props {
  modelCard: ModelCard | null;
}

export default function SiteFooter({ modelCard }: Props) {
  return (
    <footer
      className="py-12 px-6 md:px-12 lg:px-20"
      style={{
        background: "var(--bg)",
        borderTop: "1px solid var(--hairline)",
      }}
      aria-label="Site footer"
    >
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* PITWALL signature */}
        <div className="flex items-baseline gap-3">
          <span
            className="font-display font-700 text-2xl tracking-tight"
            style={{ color: "var(--ink)" }}
          >
            PITWALL
          </span>
          <span className="font-script" style={{ fontSize: "1.1rem" }}>
            strategy
          </span>
        </div>

        {/* Model card */}
        {modelCard ? (
          <p
            className="font-body text-xs leading-relaxed max-w-lg text-right"
            style={{ color: "var(--faint)" }}
          >
            Pace model trained on{" "}
            <span style={{ color: "var(--muted)" }}>
              {modelCard.n_laps.toLocaleString()}
            </span>{" "}
            real laps across {modelCard.n_circuits} circuits (
            {modelCard.years[0]}–{modelCard.years[1]}) — R²{" "}
            <span style={{ color: "var(--muted)" }}>
              {modelCard.cv_r2.toFixed(3)}
            </span>{" "}
            — MAE{" "}
            <span style={{ color: "var(--muted)" }}>
              {modelCard.cv_mae_s.toFixed(2)}s
            </span>{" "}
            — fuel effect{" "}
            <span style={{ color: "var(--muted)" }}>
              {modelCard.fuel_effect_s.toFixed(2)}s/lap
            </span>{" "}
            — race-weekend cross-validation
          </p>
        ) : (
          <p className="font-body text-xs" style={{ color: "var(--faint)" }}>
            F1 Strategy Optimizer v2
          </p>
        )}
      </div>
    </footer>
  );
}
