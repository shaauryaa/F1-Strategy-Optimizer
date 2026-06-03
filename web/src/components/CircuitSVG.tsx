"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  svgPath: string | null;
  className?: string;
}

export default function CircuitSVG({ svgPath, className = "" }: Props) {
  const pathRef = useRef<SVGPathElement>(null);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !pathRef.current || !svgPath) return;
    const el = pathRef.current;
    const len = Math.ceil(el.getTotalLength?.() ?? 2000);
    el.style.setProperty("--path-len", String(len));
    el.style.strokeDasharray = String(len);
    el.style.strokeDashoffset = String(len);
    const frame = requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1)";
      el.style.strokeDashoffset = "0";
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, svgPath]);

  if (!svgPath) return null;

  return (
    <div ref={containerRef} className={className} aria-hidden>
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background glow */}
        <path
          d={svgPath}
          stroke="var(--accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.08"
        />
        {/* Main track line */}
        <path
          ref={pathRef}
          d={svgPath}
          stroke="var(--ink)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}
