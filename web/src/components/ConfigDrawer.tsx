"use client";

import { useEffect, useRef } from "react";
import type { Circuit, Compound, OptimiseRequest } from "@/types/api";

interface Config {
  laps: number;
  temp: number;
  maxStops: number;
  scLap: number;
  vscLap: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  circuit: Circuit | undefined;
  config: Config;
  onChange: (c: Config) => void;
  onSubmit: () => void;
  loading: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg)",
  border: "1px solid var(--hairline)",
  color: "var(--ink)",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  padding: "0.5rem 0.75rem",
  outline: "none",
  appearance: "none",
  WebkitAppearance: "none",
  borderRadius: 0,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className="eyebrow"
        style={{ fontSize: "0.6rem", letterSpacing: "0.14em" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

export default function ConfigDrawer({
  open,
  onClose,
  circuit,
  config,
  onChange,
  onSubmit,
  loading,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(6,6,8,0.7)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Race configuration"
        aria-modal="true"
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col overflow-y-auto"
        style={{
          width: "min(380px, 96vw)",
          background: "var(--bg-raised)",
          borderLeft: "1px solid var(--hairline)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5"
          style={{ borderBottom: "1px solid var(--hairline)" }}
        >
          <div>
            <span className="kicker text-sm">configure</span>
            <span
              className="font-display font-600 text-lg block"
              style={{ color: "var(--ink)" }}
            >
              RACE SETUP
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-accent2"
            style={{ color: "var(--muted)" }}
            aria-label="Close configuration"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Fields */}
        <div className="flex-1 flex flex-col gap-6 px-6 py-6">
          {circuit && (
            <div
              className="p-3"
              style={{ background: "var(--bg-card)", border: "1px solid var(--hairline)" }}
            >
              <span className="eyebrow block mb-0.5">Circuit</span>
              <span
                className="font-display font-600"
                style={{ color: "var(--ink)" }}
              >
                {circuit.name}
              </span>
              <span
                className="font-body text-xs block mt-0.5"
                style={{ color: "var(--muted)" }}
              >
                typical {circuit.typical_laps} laps — median {circuit.median_pace.toFixed(1)} s/lap
              </span>
            </div>
          )}

          <Field label="Race laps">
            <input
              type="number"
              min={30}
              max={78}
              value={config.laps}
              onChange={e => onChange({ ...config, laps: Number(e.target.value) })}
              style={inputStyle}
              aria-label="Race laps"
            />
          </Field>

          <Field label={`Track temperature — ${config.temp}°C`}>
            <div className="flex flex-col gap-1.5">
              <input
                type="range"
                min={15}
                max={55}
                value={config.temp}
                onChange={e => onChange({ ...config, temp: Number(e.target.value) })}
                className="w-full accent-accent2"
                aria-label="Track temperature"
                style={{ accentColor: "var(--accent2)" }}
              />
              <div
                className="flex justify-between font-body text-xs tabular-nums"
                style={{ color: "var(--faint)" }}
                aria-hidden
              >
                <span>15°</span>
                <span>55°</span>
              </div>
            </div>
          </Field>

          <Field label="Max pit stops">
            <div
              className="grid grid-cols-3 gap-px"
              style={{ background: "var(--hairline)" }}
              role="radiogroup"
              aria-label="Maximum pit stops"
            >
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={config.maxStops === n}
                  onClick={() => onChange({ ...config, maxStops: n })}
                  className="py-2.5 font-display font-600 text-base transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-accent2"
                  style={{
                    background:
                      config.maxStops === n ? "rgba(52,224,230,0.12)" : "var(--bg-card)",
                    color:
                      config.maxStops === n ? "var(--accent2)" : "var(--muted)",
                    border:
                      config.maxStops === n
                        ? "1px solid rgba(52,224,230,0.25)"
                        : "1px solid transparent",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </Field>

          <div
            className="pt-4"
            style={{ borderTop: "1px solid var(--hairline)" }}
          >
            <span
              className="eyebrow block mb-4"
              style={{ color: "var(--faint)" }}
            >
              Safety car (optional)
            </span>
            <div className="grid grid-cols-2 gap-4">
              <Field label="SC lap (0 = none)">
                <input
                  type="number"
                  min={0}
                  max={78}
                  value={config.scLap}
                  onChange={e => onChange({ ...config, scLap: Number(e.target.value) })}
                  style={inputStyle}
                  aria-label="Safety car lap"
                />
              </Field>
              <Field label="VSC lap (0 = none)">
                <input
                  type="number"
                  min={0}
                  max={78}
                  value={config.vscLap}
                  onChange={e => onChange({ ...config, vscLap: Number(e.target.value) })}
                  style={inputStyle}
                  aria-label="Virtual safety car lap"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div
          className="px-6 py-5"
          style={{ borderTop: "1px solid var(--hairline)" }}
        >
          <button
            onClick={() => { onSubmit(); onClose(); }}
            disabled={loading || !circuit}
            className="w-full py-4 font-display font-600 tracking-widest text-sm uppercase transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent2 disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "var(--ink)",
              letterSpacing: "0.12em",
            }}
            aria-label="Run optimisation"
          >
            {loading ? "OPTIMISING" : "OPTIMISE"}
          </button>
        </div>
      </aside>
    </>
  );
}
