"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { CALLOUTS, heroStore } from "@/lib/heroStore";

/** Posições fixas dos rótulos (percentuais do palco). A linha e o ponto são atualizados pela cena. */
const POS = [
  "left-5 top-[73%] md:left-[8%] md:top-[20%]",
  "right-5 top-[73%] text-right md:right-[8%] md:top-[62%]",
  "left-5 top-[73%] md:left-[8%] md:top-[58%]",
  "right-5 top-[73%] text-right md:right-[8%] md:top-[24%]",
];

export default function Callouts() {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    return () => {
      heroStore.calloutEls = [];
      heroStore.lineEls = [];
      heroStore.dotEls = [];
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 motion-reduce:hidden" aria-hidden>
      <svg ref={svg} className="absolute inset-0 h-full w-full overflow-visible">
        {CALLOUTS.map((c, i) => (
          <g key={c.id}>
            <line
              ref={(el) => {
                heroStore.lineEls[i] = el;
              }}
              stroke="rgba(255,255,255,0.55)"
              strokeWidth="1"
              style={{ opacity: 0 }}
            />
            <circle
              ref={(el) => {
                heroStore.dotEls[i] = el;
              }}
              r="4"
              fill="#0a0a0a"
              stroke="#fff"
              strokeWidth="1.5"
              style={{ opacity: 0 }}
            />
          </g>
        ))}
      </svg>
      {CALLOUTS.map((c, i) => (
        <div
          key={c.id}
          ref={(el) => {
            heroStore.calloutEls[i] = el;
          }}
          style={{ opacity: 0 }}
          className={clsx("absolute max-w-[46vw] [text-shadow:0_1px_12px_rgba(0,0,0,0.9)] md:max-w-[260px]", POS[i])}
        >
          <span className="label block text-white/70">0{i + 1}</span>
          <p className="mt-1 text-[15px] font-semibold leading-tight tracking-[-0.01em] md:text-lg">{c.title}</p>
          <p className="mt-1 text-xs text-white/55 md:text-sm">{c.text}</p>
        </div>
      ))}
    </div>
  );
}
