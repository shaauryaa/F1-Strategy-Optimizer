"use client";

import { useEffect, useRef, useState } from "react";
import type { OptimiseResponse } from "@/types/api";

interface Props {
  result: OptimiseResponse;
}

function useCountUp(target: number, enabled: boolean, duration = 1400) {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { setVal(target); return; }
    setVal(0);
    startRef.current = null;
    const animate = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const t = Math.min((now - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, enabled, duration]);

  return val;
}

function StatCard({
  kicker,
  label,
  target,
  suffix,
  note,
  enabled,
  duration,
}: {
  kicker: string;
  label: string;
  target: number;
  suffix: string;
  note: string;
  enabled: boolean;
  duration?: number;
}) {
  const val = useCountUp(target, enabled, duration ?? 1400);

  return (
    <div
      className="flex flex-col gap-4 p-8 md:p-10"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--hairline)",
      }}
    >
      <span className="kicker text-base">{kicker}</span>
      <div
        className="font-display font-700 leading-none tabular-nums count-up"
        style={{
          fontSize: "clamp(3.5rem, 6vw, 5.5rem)",
          color: "var(--ink)",
          letterSpacing: "-0.02em",
        }}
      >
        {val >= 1 ? val.toFixed(1) : "0.0"}
        <span
          className="font-body font-400 ml-1"
          style={{
            fontSize: "clamp(1.2rem, 2vw, 1.8rem)",
            color: "var(--muted)",
          }}
        >
          {suffix}
        </span>
      </div>
      <p
        className="font-display font-600"
        style={{
          fontSize: "clamp(1rem, 1.5vw, 1.3rem)",
          color: "var(--ink)",
        }}
      >
        {label}
      </p>
      <p className="font-body text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        {note}
      </p>
    </div>
  );
}

export default function WhatItBuysYou({ result }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) { setVisible(true); obs.disconnect(); }
      },
      { threshold: 0.25 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const rec = result.recommended;
  const baselineEnd = result.pace_curve.baseline_cum.at(-1) ?? 0;
  const recEnd = result.pace_curve.recommended_cum.at(-1) ?? 0;
  const savedS = Math.max(0, baselineEnd - recEnd);
  const riskBandMin = (rec.mc.p90 - rec.mc.p10) / 60;
  const mcMeanS = rec.mc.mean - rec.total_s;

  return (
    <section
      ref={ref}
      className="py-24 px-6 md:px-12 lg:px-20"
      style={{ background: "var(--bg)" }}
      aria-label="Strategy benefits"
    >
      <div className="max-w-6xl mx-auto">
        <div className="mb-14">
          <span className="kicker">numbers</span>
          <h2
            className="font-display font-700 leading-none"
            style={{
              fontSize: "clamp(2.4rem, 5vw, 4rem)",
              color: "var(--ink)",
            }}
          >
            WHAT IT BUYS YOU
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px"
          style={{ background: "var(--hairline)" }}
        >
          <StatCard
            kicker="versus one stop"
            label="seconds faster"
            target={savedS}
            suffix="s"
            note={`Against a naive mid-race single stop on mediums. The optimal sequence saves ${savedS.toFixed(1)} s of race time on a clean run.`}
            enabled={visible}
            duration={1600}
          />
          <StatCard
            kicker="safety car cost"
            label="expected time added"
            target={mcMeanS}
            suffix="s"
            note={`The Monte Carlo mean adds ${mcMeanS.toFixed(1)} s over the deterministic result — the price of safety car uncertainty baked in.`}
            enabled={visible}
            duration={1400}
          />
          <StatCard
            kicker="lucky to unlucky"
            label="minutes of risk spread"
            target={riskBandMin}
            suffix="m"
            note={`The p10 to p90 spread is ${riskBandMin.toFixed(2)} minutes. A safety car at the wrong lap can cost that much against a perfectly clean race.`}
            enabled={visible}
            duration={1800}
          />
        </div>
      </div>
    </section>
  );
}
