"use client";

import { useRef } from "react";
import clsx from "clsx";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { config, isCheckoutReady } from "@/lib/config";
import { buildCheckoutUrl, trackCliqueCheckout, type CtaPosition } from "@/lib/tracking";

type Props = {
  posicao: CtaPosition;
  className?: string;
  label?: string;
  id?: string;
  size?: "md" | "sm";
};

/** Botão de compra: magnético no desktop, brilho periódico, microinteração no press. */
export default function BuyButton({ posicao, className, label = config.cta.label, id, size = "md" }: Props) {
  const ref = useRef<HTMLAnchorElement>(null);
  const reduced = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(my, { stiffness: 220, damping: 18, mass: 0.4 });

  const onMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (reduced || e.pointerType !== "mouse") return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - (r.left + r.width / 2)) * 0.28);
    my.set((e.clientY - (r.top + r.height / 2)) * 0.35);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    trackCliqueCheckout(posicao);
    e.preventDefault();
    if (!isCheckoutReady) return;
    window.location.assign(buildCheckoutUrl(config.cta.checkoutUrl));
  };

  return (
    <motion.a
      ref={ref}
      id={id}
      href={isCheckoutReady ? config.cta.checkoutUrl : "#"}
      onClick={onClick}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      whileTap={reduced ? undefined : { scale: 0.96 }}
      style={{ x, y }}
      aria-disabled={!isCheckoutReady}
      data-posicao={posicao}
      className={clsx(
        "btn-shine group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-full bg-white text-ink",
        "font-semibold tracking-[0.02em] transition-colors duration-200 hover:bg-neutral-100",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white",
        size === "md" ? "h-14 w-full max-w-sm px-8 text-[15px]" : "h-11 px-5 text-sm",
        !isCheckoutReady && "cursor-default",
        className,
      )}
    >
      <span className="relative z-10">{label}</span>
      <svg
        aria-hidden
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="relative z-10 transition-transform duration-200 group-hover:translate-x-0.5"
      >
        <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.a>
  );
}
