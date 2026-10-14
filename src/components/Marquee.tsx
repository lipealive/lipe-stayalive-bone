"use client";

import { useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
  wrap,
} from "framer-motion";

const WORDS = ["MOVIMENTO", "ROTINA", "CIDADE", "NATUREZA", "LIBERDADE"];

/** Faixa infinita cuja velocidade e direção reagem ao scroll. */
export default function Marquee({ baseVelocity = 2 }: { baseVelocity?: number }) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const { scrollY } = useScroll();
  const velocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(velocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smoothVelocity, [0, 1200], [0, 6], { clamp: false });
  const direction = useRef(1);

  useAnimationFrame((_, delta) => {
    if (reduced) return;
    let move = direction.current * baseVelocity * (delta / 1000);
    const f = factor.get();
    if (f < 0) direction.current = -1;
    else if (f > 0) direction.current = 1;
    move += direction.current * Math.abs(f) * (delta / 1000) * baseVelocity;
    x.set(x.get() + move);
  });

  const xPct = useTransform(x, (v) => `${wrap(-25, 0, -v)}%`);

  const line = (
    <span className="flex shrink-0 items-center">
      {WORDS.map((w) => (
        <span key={w} className="flex items-center">
          <span className="px-5 text-[13px] font-semibold uppercase tracking-[0.32em] text-white/70 md:px-8 md:text-sm">{w}</span>
          <span aria-hidden className="h-1 w-1 rounded-full bg-white/40" />
        </span>
      ))}
    </span>
  );

  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-ink py-4 md:py-5" aria-label={WORDS.join(", ")}>
      <motion.div className="flex w-max whitespace-nowrap" style={{ x: xPct }}>
        {line}
        {line}
        {line}
        {line}
      </motion.div>
    </div>
  );
}
