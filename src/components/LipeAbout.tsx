"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { config } from "@/lib/config";

const EASE = [0.22, 1, 0.36, 1] as const;
const viewport = { once: true, margin: "-12% 0px" } as const;
const fmt = (decimals: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

function CountUp({ value, decimals, active, delay }: { value: number; decimals: number; active: boolean; delay: number }) {
  const reduced = !!useReducedMotion();
  const [n, setN] = useState(reduced ? value : 0);
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      setN(value);
      return;
    }
    const controls = animate(0, value, { duration: 1.4, delay, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setN(v) });
    return () => controls.stop();
  }, [active, value, delay, reduced]);
  return <>{fmt(decimals).format(n)}</>;
}

/**
 * Seção "Sobre o Lipe": card compacto de credibilidade, mesma estrutura da LP Alive Finance,
 * adaptado ao visual preto e às animações de entrada da dobra 2.
 */
export default function LipeAbout() {
  const reduced = !!useReducedMotion();
  const lipe = config.lipe;
  const statsRef = useRef<HTMLParagraphElement>(null);
  const statsInView = useInView(statsRef, { once: true, amount: 0.6 });

  const item = (i: number) => ({
    initial: reduced ? false : { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport,
    transition: { duration: 0.7, delay: 0.1 + i * 0.08, ease: EASE },
  });

  return (
    <section id="sobre" className="relative overflow-x-clip bg-ink px-5 pb-20 pt-28 md:pb-28 md:pt-36">
      <motion.div
        className="relative mx-auto w-full max-w-[900px]"
        initial={reduced ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.9, ease: EASE }}
      >
        {/* glow */}
        <div aria-hidden className="absolute -inset-6 -z-10 rounded-[40px] bg-[radial-gradient(closest-side,rgba(255,255,255,0.09),transparent)] blur-2xl" />

        <div className="relative rounded-3xl border border-white/10 bg-ink-2 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)]">
          <div className="grid grid-cols-1 items-center gap-6 px-6 pb-8 pt-28 text-center sm:px-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 lg:px-10 lg:py-8 lg:text-left">
            {/* Foto pop-out: a cabeça passa da borda superior do card */}
            <div className="pointer-events-none absolute -top-16 left-1/2 h-44 w-40 -translate-x-1/2 lg:bottom-0 lg:left-10 lg:top-auto lg:h-[calc(100%+2.5rem)] lg:w-[220px] lg:translate-x-0">
              <div className="relative size-full overflow-hidden rounded-b-3xl [mask-image:linear-gradient(to_bottom,black_78%,transparent)] lg:[mask-image:none]">
                <Image
                  src={lipe.photo}
                  alt={`${lipe.name}, criador do ${config.product.name}`}
                  fill
                  sizes="(min-width: 1024px) 360px, 260px"
                  className="origin-top scale-[1.55] object-cover object-top"
                />
              </div>
              {/* Sticker girando devagar */}
              <div className="absolute -right-4 top-2 size-14 sm:size-16 lg:-right-5 lg:top-6 lg:size-[72px]">
                <div className="flex size-full animate-spin-slow items-center justify-center rounded-full border-[3px] border-white/15 bg-ink shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] motion-reduce:animate-none">
                  <Image src={lipe.logo} alt="" width={1080} height={1075} sizes="64px" className="size-[62%]" />
                </div>
              </div>
            </div>
            <div aria-hidden className="hidden lg:block" />

            {/* Texto */}
            <div className="flex flex-col items-center gap-3 lg:items-start">
              <motion.span {...item(0)} className="label">
                Criado por
              </motion.span>

              <motion.h2 {...item(1)} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 lg:justify-start">
                <span className="text-3xl font-extrabold leading-none tracking-[-0.03em] sm:text-4xl">{lipe.name}</span>
                <VerifiedIcon />
                <a
                  href={lipe.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm text-base font-medium text-white/55 transition-colors hover:text-white sm:text-lg"
                >
                  {lipe.handle}
                </a>
              </motion.h2>

              <motion.p {...item(2)} className="text-lg font-semibold italic text-white/90 sm:text-xl">
                {lipe.tagline}
              </motion.p>

              <motion.p {...item(3)} className="max-w-[52ch] text-pretty text-[15px] text-white/60 sm:text-base">
                {lipe.line}
              </motion.p>

              <motion.p
                {...item(4)}
                ref={statsRef}
                className="mt-1 flex flex-col items-center gap-1.5 text-sm font-semibold sm:flex-row sm:gap-3 lg:justify-start"
              >
                {lipe.stats.map((s, i) => (
                  <span key={s.label} className="flex items-center gap-3">
                    {i > 0 && <span aria-hidden className="hidden size-1 rounded-full bg-white/20 sm:block" />}
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group inline-flex items-center gap-1 rounded-sm"
                    >
                      <span className="tabular-nums text-white">
                        <CountUp value={s.value} decimals={s.decimals} active={statsInView} delay={i * 0.15} /> {s.unit}
                      </span>{" "}
                      <span className="text-white/55 underline decoration-white/20 decoration-1 underline-offset-4 transition-colors group-hover:text-white group-hover:decoration-white">
                        {s.label}
                      </span>
                      <svg
                        aria-hidden
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-white/55 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white"
                      >
                        <path d="M4 12L12 4M6 4h6v6" />
                      </svg>
                    </a>
                  </span>
                ))}
              </motion.p>

              <motion.div {...item(5)} className="mt-2 flex items-center gap-2.5">
                <span className="font-script text-3xl font-bold leading-none sm:text-4xl">{lipe.signature}</span>
                <Image src={lipe.logo} alt="" width={316} height={313} sizes="28px" className="size-6 sm:size-7" />
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function VerifiedIcon() {
  return (
    <svg aria-label="Verificado" role="img" width="26" height="26" viewBox="0 0 24 24" className="size-6 sm:size-7">
      <path
        d="M12 1.6l2.4 2 3.1-.4 1.2 2.9 2.7 1.6-.6 3.1 1.6 2.7-2.1 2.3.3 3.1-3 .9-1.6 2.7-3-1-2.9 1.1-1.7-2.6-3-.8.2-3.1L3.5 14l1.7-2.7-.6-3.1 2.7-1.6 1.2-2.9 3.1.4z"
        fill="#1d9bf0"
      />
      <path d="M8.5 12.2l2.3 2.3 4.8-4.8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
