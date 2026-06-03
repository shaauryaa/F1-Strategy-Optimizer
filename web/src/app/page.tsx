"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hero from "@/components/Hero";
import ThePlan from "@/components/ThePlan";
import WhatItBuysYou from "@/components/WhatItBuysYou";
import TheRoadNotTaken from "@/components/TheRoadNotTaken";
import SiteFooter from "@/components/SiteFooter";
import ConfigDrawer from "@/components/ConfigDrawer";
import { fetchCircuits, fetchModelCard, postOptimise } from "@/lib/api";
import type {
  Circuit,
  CircuitGeo,
  ModelCard,
  OptimiseResponse,
} from "@/types/api";

function SkeletonBlock({ h, w }: { h: number; w?: string }) {
  return (
    <div
      className="skeleton-block"
      style={{ height: h, width: w ?? "100%", marginBottom: 12 }}
    />
  );
}

function ResultsSkeleton({ phase }: { phase: "optimising" | "cold" | "" }) {
  const isCold = phase === "cold";
  return (
    <div aria-live="polite" aria-busy="true" aria-label="Loading results">
      {/* Strategy plan skeleton */}
      <section
        className="py-16 px-6 md:px-12 lg:px-20"
        style={{ background: "var(--bg-raised)", borderTop: "1px solid var(--hairline)" }}
      >
        <div className="max-w-6xl mx-auto">
          <SkeletonBlock h={13} w="70px" />
          <SkeletonBlock h={44} w="55%" />
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: "var(--hairline)" }}>
            {[0, 1, 2].map(i => (
              <div key={i} className="p-8" style={{ background: "var(--bg-card)" }}>
                <SkeletonBlock h={11} w="80px" />
                <SkeletonBlock h={56} w="60%" />
                <SkeletonBlock h={13} w="75%" />
                <SkeletonBlock h={13} w="90%" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ranked strategies skeleton */}
      <section
        className="py-16 px-6 md:px-12 lg:px-20"
        style={{ background: "var(--bg)" }}
      >
        <div className="max-w-6xl mx-auto">
          <SkeletonBlock h={13} w="90px" />
          <SkeletonBlock h={44} w="50%" />
          <div className="mt-10 flex flex-col gap-3">
            {[1, 0.88, 0.76, 0.64, 0.52].map((op, i) => (
              <div
                key={i}
                className="skeleton-block"
                style={{ height: 64, opacity: op }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Undercut check skeleton */}
      <section
        className="py-16 px-6 md:px-12 lg:px-20"
        style={{ background: "var(--bg-raised)" }}
      >
        <div className="max-w-6xl mx-auto">
          <SkeletonBlock h={13} w="110px" />
          <SkeletonBlock h={44} w="45%" />
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="skeleton-block" style={{ height: 88 }} />
            ))}
          </div>
        </div>
      </section>

      {/* Cold-start notice — only shown after 5 s */}
      {isCold && (
        <div
          className="py-6 px-6 flex justify-center"
          style={{ background: "var(--bg)" }}
        >
          <p
            className="font-body text-sm text-center cold-pulse"
            style={{ color: "var(--muted)", maxWidth: 400 }}
          >
            Still working — Render&apos;s free tier needs ~30 s to wake up on first load.
            Results will appear automatically.
          </p>
        </div>
      )}
    </div>
  );
}

interface Config {
  laps: number;
  temp: number;
  maxStops: number;
  scLap: number;
  vscLap: number;
}

const FIXED_YEAR = 2024;

export default function Page() {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [geoData, setGeoData] = useState<Record<string, CircuitGeo>>({});
  const [modelCard, setModelCard] = useState<ModelCard | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [config, setConfig] = useState<Config>({
    laps: 52,
    temp: 35,
    maxStops: 2,
    scLap: 0,
    vscLap: 0,
  });
  const [result, setResult] = useState<OptimiseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<"optimising" | "cold" | "">("");
  const [error, setError] = useState<string | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Load circuits, model card, and geo data on mount
  useEffect(() => {
    fetchCircuits().then(cs => {
      setCircuits(cs);
    }).catch(() => {});

    fetchModelCard().then(setModelCard).catch(() => {});

    fetch("/circuits-geo.json")
      .then(r => r.json())
      .then((d: Record<string, CircuitGeo>) => setGeoData(d))
      .catch(() => {});
  }, []);

  // When circuit changes, reset laps to typical
  const handleCircuitChange = useCallback(
    (slug: string) => {
      setSelectedSlug(slug);
      const c = circuits.find(x => x.slug === slug);
      if (c) setConfig(prev => ({ ...prev, laps: c.typical_laps }));
      setResult(null);
      setError(null);
    },
    [circuits]
  );

  const runOptimise = useCallback(async () => {
    setLoading(true);
    setLoadingPhase("optimising");
    setError(null);
    // After 5 s with no response, switch to cold-start message
    phaseTimer.current = setTimeout(() => setLoadingPhase("cold"), 5000);
    try {
      const res = await postOptimise({
        circuit: selectedSlug,
        year: FIXED_YEAR,
        laps: config.laps,
        temp: config.temp,
        start_compound: null,
        max_stops: config.maxStops,
        sc_lap: config.scLap,
        vsc_lap: config.vscLap,
      });
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimisation failed");
    } finally {
      if (phaseTimer.current) clearTimeout(phaseTimer.current);
      setLoadingPhase("");
      setLoading(false);
    }
  }, [selectedSlug, config]);

  const selectedCircuit = circuits.find(c => c.slug === selectedSlug);
  const geo = geoData[selectedSlug];
  const circuitPath = geo?.path ?? null;
  const gpName = geo?.gp ?? "";

  return (
    <div className="relative">
      {/* Error banner */}
      {error && (
        <div
          role="alert"
          className="fixed top-16 right-6 z-30 px-4 py-3 font-body text-sm max-w-sm"
          style={{
            background: "rgba(255,24,1,0.12)",
            border: "1px solid rgba(255,24,1,0.3)",
            color: "#FF6B5A",
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 opacity-60 hover:opacity-100"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Config drawer */}
      <ConfigDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        circuit={selectedCircuit}
        config={config}
        onChange={setConfig}
        onSubmit={runOptimise}
        loading={loading}
      />

      {/* Hero — always visible */}
      <Hero
        circuits={circuits}
        selectedSlug={selectedSlug}
        onCircuitChange={handleCircuitChange}
        result={result}
        loading={loading}
        loadingPhase={loadingPhase}
        gpName={gpName}
        onConfigOpen={() => setDrawerOpen(true)}
      />

      {/* Results sections — fade in when data arrives */}
      {result && !loading && (
        <div className="results-enter">
          <ThePlan result={result} circuitPath={circuitPath} />
          <WhatItBuysYou result={result} />
          <TheRoadNotTaken result={result} />
        </div>
      )}

      {/* Initial call-to-action when no result yet */}
      {!result && !loading && (
        <section
          className="py-24 px-6 flex flex-col items-center justify-center gap-6 text-center"
          style={{ background: "var(--bg-raised)", minHeight: "40vh" }}
          aria-label="Get started"
        >
          <p
            className="font-display max-w-lg"
            style={{
              fontSize: "clamp(1.4rem, 3vw, 2rem)",
              color: "var(--ink)",
              fontWeight: 600,
            }}
          >
            CONFIGURE YOUR RACE AND HIT OPTIMISE
          </p>
          <p
            className="font-body text-sm max-w-md leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            The engine searches every legal stop and compound sequence, ranks by
            Monte Carlo expected time under safety car uncertainty, and builds
            the undercut analysis for each stop.
          </p>
          <button
            onClick={() => setDrawerOpen(true)}
            className="mt-2 px-8 py-4 font-display text-sm uppercase transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2"
            style={{
              background: "var(--accent)",
              color: "var(--ink)",
              letterSpacing: "0.12em",
              fontWeight: 600,
            }}
            aria-label="Open configuration"
          >
            OPEN CONFIG
          </button>

          {modelCard && (
            <div
              className="grid grid-cols-3 gap-px mt-8 w-full max-w-sm"
              style={{ background: "var(--hairline)" }}
            >
              {[
                { v: modelCard.cv_r2.toFixed(3), l: "R² accuracy" },
                { v: `${modelCard.cv_mae_s.toFixed(1)}s`, l: "Avg MAE" },
                { v: String(modelCard.n_circuits), l: "Circuits" },
              ].map(({ v, l }) => (
                <div
                  key={l}
                  className="flex flex-col items-center py-5"
                  style={{ background: "var(--bg-card)" }}
                >
                  <span
                    className="font-display text-2xl tabular-nums"
                    style={{ color: "var(--accent2)", fontWeight: 700 }}
                  >
                    {v}
                  </span>
                  <span
                    className="eyebrow mt-1"
                    style={{ color: "var(--faint)", fontSize: "0.58rem" }}
                  >
                    {l}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Skeleton — visible while loading */}
      {loading && <ResultsSkeleton phase={loadingPhase} />}

      <SiteFooter modelCard={modelCard} />
    </div>
  );
}
