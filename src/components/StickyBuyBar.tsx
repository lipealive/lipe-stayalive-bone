"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { config } from "@/lib/config";
import BuyButton from "./BuyButton";

/**
 * Barra fixa de compra (mobile). Aparece quando o botão do hero sai pelo topo
 * e some enquanto o botão da dobra 2 ou a seção "Sobre o Lipe" estão visíveis.
 */
export default function StickyBuyBar() {
  const [heroGone, setHeroGone] = useState(false);
  const [dobraVisible, setDobraVisible] = useState(false);
  const [sobreVisible, setSobreVisible] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const hero = document.getElementById("cta-hero");
    const dobra = document.getElementById("cta-dobra2");
    const sobre = document.getElementById("sobre");
    if (!hero || !dobra) return;
    const ioHero = new IntersectionObserver(
      ([e]) => setHeroGone(!e.isIntersecting && e.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    const ioDobra = new IntersectionObserver(([e]) => setDobraVisible(e.isIntersecting), { threshold: 0.2 });
    const ioSobre = new IntersectionObserver(([e]) => setSobreVisible(e.isIntersecting), { threshold: 0.05 });
    ioHero.observe(hero);
    ioDobra.observe(dobra);
    if (sobre) ioSobre.observe(sobre);
    return () => {
      ioHero.disconnect();
      ioDobra.disconnect();
      ioSobre.disconnect();
    };
  }, []);

  const show = heroGone && !dobraVisible && !sobreVisible;

  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          key="sticky-bar"
          initial={reduced ? { opacity: 0 } : { y: "110%" }}
          animate={reduced ? { opacity: 1 } : { y: 0 }}
          exit={reduced ? { opacity: 0 } : { y: "110%" }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-50 md:hidden"
        >
          <div className="mx-3 mb-[max(12px,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink-2/90 px-4 py-3 shadow-[0_-10px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-[0.2em] text-white/50">{config.product.shortName}</p>
              <p className="text-lg font-semibold leading-tight tracking-[-0.02em]">{config.product.priceLabel}</p>
            </div>
            <BuyButton posicao="sticky" size="sm" className="shrink-0" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
