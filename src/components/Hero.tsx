"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { config } from "@/lib/config";
import { heroStore } from "@/lib/heroStore";
import BuyButton from "./BuyButton";
import BoneSpin, { type BoneSpinProps } from "./BoneSpin";
import Callouts from "./hero3d/Callouts";

const Scene = dynamic(() => import("./hero3d/Scene"), { ssr: false });

type Props = Pick<BoneSpinProps, "hasVideo" | "hasPoster" | "hasGlb">;

const EASE = [0.22, 1, 0.36, 1] as const;

/** Título revelado letra por letra. */
function Letters({ text, delay, reduced }: { text: string; delay: number; reduced: boolean }) {
  return (
    <span aria-label={text} role="text" className="inline-block">
      {text.split("").map((ch, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span
            className="inline-block"
            initial={reduced ? false : { y: "115%" }}
            animate={{ y: 0 }}
            transition={{ delay: delay + i * 0.022, duration: 0.6, ease: EASE }}
          >
            {ch === " " ? " " : ch}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Brilho pulsando + linha fina de progresso (indeterminada até a cena ficar pronta). */
function HeroLoader({ done }: { done: boolean }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[8%] flex h-[46%] w-[82%] -translate-x-1/2 flex-col items-center justify-center md:top-[12%] md:h-[58%] md:w-[40%]"
      initial={{ opacity: 1 }}
      animate={{ opacity: done ? 0 : 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <motion.div
        className="h-[55%] w-[70%] rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.16),rgba(255,255,255,0.04)_55%,transparent)] blur-xl"
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.96, 1.04, 0.96] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="relative mt-6 h-px w-28 overflow-hidden bg-white/10">
        <motion.span
          className="absolute inset-y-0 left-0 w-1/3 bg-white/70"
          animate={done ? { x: "0%", width: "100%" } : { x: ["-100%", "300%"] }}
          transition={done ? { duration: 0.3 } : { duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </motion.div>
  );
}

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function Hero({ hasVideo, hasPoster, hasGlb }: Props) {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const reducedPref = useReducedMotion();
  const reduced = !!reducedPref;
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  /** null = ainda não testado; false = sem WebGL (usa imagem com máscara) */
  const [webgl, setWebgl] = useState<boolean | null>(null);
  /** Bibliotecas 3D avaliadas em etapas (um chunk por tarefa) antes de montar a cena. */
  const [libsReady, setLibsReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const is3d = config.hero.mode === "3d";

  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    heroStore.progress = Number.isFinite(v) ? v : 0;
  });

  const copyOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0]);
  const copyY = useTransform(scrollYProgress, [0, 0.1], [0, -28]);
  const bigY = useTransform(scrollYProgress, [0, 1], ["0%", "-40%"]);
  const bigScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const bigOpacity = useTransform(scrollYProgress, [0, 0.68, 0.92], [1, 1, 0]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.05], [1, 0]);

  useEffect(() => {
    setMounted(true);
    heroStore.stageEl = stage.current;
    try {
      const c = document.createElement("canvas");
      setWebgl(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch {
      setWebgl(false);
    }
  }, []);

  useEffect(() => {
    if (!is3d || !hasGlb || reduced || webgl !== true) return;
    let cancelled = false;
    (async () => {
      performance.mark("hero:libs-start");
      await import("three");
      await import("@react-three/fiber");
      await import("@react-three/postprocessing");
      performance.mark("hero:libs-ready");
      if (!cancelled) setLibsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [is3d, hasGlb, reduced, webgl]);

  /** Imagem estática só sem WebGL, com reduced-motion ou se a cena falhar. */
  const useFallbackImage = is3d && (reduced || webgl === false || sceneFailed || !hasGlb);
  const show3d = is3d && hasGlb && mounted && libsReady && !reduced && webgl !== false && !sceneFailed;

  const onReady = useCallback(() => setReady(true), []);

  /* ---- mouse (tilt) e arrasto (girar) ---- */
  const last = useRef({ x: 0, t: 0 });
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (heroStore.dragging) {
      const dx = e.clientX - last.current.x;
      heroStore.dragImpulse += dx * 0.006;
      heroStore.dragVelocity = dx * 0.006;
      last.current = { x: e.clientX, t: performance.now() };
      return;
    }
    if (e.pointerType !== "mouse") return;
    const r = stage.current?.getBoundingClientRect();
    if (!r) return;
    heroStore.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    heroStore.mouse.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest("a,button")) return;
    heroStore.dragging = true;
    heroStore.dragVelocity = 0;
    last.current = { x: e.clientX, t: performance.now() };
    stage.current?.setPointerCapture(e.pointerId);
  };
  const endDrag = () => {
    if (!heroStore.dragging) return;
    heroStore.dragging = false;
    if (performance.now() - last.current.t > 90) heroStore.dragVelocity = 0;
  };
  const onPointerLeave = () => {
    heroStore.mouse.x = 0;
    heroStore.mouse.y = 0;
  };

  const d = (s: number) => (reduced ? 0 : s);

  return (
    <section ref={section} id="hero" className={clsx("relative", is3d ? "h-[170svh] motion-reduce:h-[100svh]" : "h-[100svh]")}>
      <div
        ref={stage}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={onPointerLeave}
        className="sticky top-0 h-[100svh] w-full overflow-hidden"
        style={{ touchAction: "pan-y" }}
      >
        {/* spotlight já aceso na tela toda */}
        <div aria-hidden className="spotlight pointer-events-none absolute inset-0" />
        <div aria-hidden className="grain pointer-events-none absolute inset-0" />

        {/* faixa de luz horizontal atrás do outline, de borda a borda */}
        <motion.div
          aria-hidden
          className="lightband pointer-events-none absolute inset-x-0 top-[38%] h-[26vh] -translate-y-1/2 md:top-1/2"
          style={reduced ? undefined : { y: bigY, opacity: bigOpacity }}
        />

        {/* STAY ALIVE. gigante em outline, com parallax */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[38%] flex -translate-y-1/2 justify-center md:top-1/2">
          <motion.span
            className="outline-text select-none whitespace-nowrap text-center font-extrabold leading-none"
            style={reduced ? undefined : { y: bigY, scale: bigScale, opacity: bigOpacity }}
          >
            STAY ALIVE.
          </motion.span>
        </div>

        {/* loader discreto enquanto o 3D carrega: brilho pulsando + linha de progresso */}
        {is3d && !useFallbackImage ? <HeroLoader done={ready} /> : null}

        {/* fallback: sem WebGL ou reduced-motion. Máscara radial, sem bordas. */}
        {useFallbackImage ? (
          <div className="pointer-events-none absolute left-1/2 top-[6%] h-[48%] w-[88%] -translate-x-1/2 md:top-[10%] md:h-[60%] md:w-[44%]">
            <div className="hero-fallback-mask relative h-full w-full">
              <Image
                src={config.media.bone.placeholder}
                alt={config.product.name}
                fill
                sizes="(min-width: 768px) 44vw, 88vw"
                className="object-contain"
              />
            </div>
          </div>
        ) : null}

        {/* cena 3D (client only) ou vídeo 360 */}
        {is3d ? (
          show3d ? (
            <SceneBoundary onError={() => setSceneFailed(true)}>
              <Scene onReady={onReady} onError={() => setSceneFailed(true)} />
            </SceneBoundary>
          ) : null
        ) : (
          <div className="absolute inset-x-0 top-[6%] md:top-[10%]">
            <BoneSpin hasVideo={hasVideo} hasPoster={hasPoster} />
          </div>
        )}

        {is3d ? <Callouts /> : null}

        {/* copy do hero: renderiza no SSR, antes do canvas */}
        <motion.div
          style={reduced ? undefined : { opacity: copyOpacity, y: copyY }}
          className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center px-5 pb-[calc(env(safe-area-inset-bottom)+96px)] text-center md:pb-28"
        >
          <motion.span
            className="label mb-4"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: d(0.05), ease: EASE }}
          >
            {config.hero.eyebrow}
          </motion.span>

          <h1 className="text-balance text-[48px] font-bold leading-[0.95] tracking-[-0.035em] md:text-[76px]">
            <Letters text={config.hero.title} delay={d(0.1)} reduced={reduced} />
          </h1>

          <motion.p
            className="mt-3 text-base text-white/60 md:text-lg"
            initial={reduced ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: d(0.3), ease: EASE }}
          >
            {config.hero.subtitle}
          </motion.p>

          <motion.div
            className="mt-6 flex w-full flex-col items-center"
            initial={reduced ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: d(0.4), ease: EASE }}
          >
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-[-0.02em] md:text-3xl">{config.product.priceLabel}</span>
              <span className="text-sm text-white/50">{config.product.installmentsLabel}</span>
            </div>
            <BuyButton id="cta-hero" posicao="hero" className="mt-5" />
            <p className="mt-3 text-xs tracking-[0.04em] text-white/45">{config.cta.microcopy}</p>
          </motion.div>
        </motion.div>

        {/* indicador de rolagem, em área própria */}
        <motion.a
          href="#lipe"
          aria-label="Rolar para a próxima seção"
          style={reduced ? undefined : { opacity: hintOpacity }}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: d(0.9) }}
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+14px)] left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 text-white/40 transition-colors hover:text-white/70 md:bottom-6"
        >
          <span className="text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <span className="relative block h-8 w-px overflow-hidden bg-white/15">
            <span className="absolute left-0 top-0 block h-3 w-full animate-scrollhint bg-white/70" />
          </span>
        </motion.a>
      </div>
    </section>
  );
}
