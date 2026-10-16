"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { config } from "@/lib/config";
import { trackVideoRepetir, trackVsl } from "@/lib/tracking";

type Props = { hasVideo: boolean; hasPoster: boolean };
type Phase = "idle" | "countdown" | "playing" | "rest";

const MILESTONES = [25, 50, 75, 95] as const;
const TICK_MS = 900;
const REST_MS = 4000;
/** Fade para preto no fim do vídeo (a última cena tem fundo branco). */
const FADE_OUT_S = 0.4;
const VEIL_IN_MS = 600;

/**
 * Card do filme do boné, em ciclo enquanto estiver na tela:
 * contagem 3-2-1 → vídeo (mudo, ou com som se a pessoa ativou) → fade para preto →
 * imagem do bordado por ~4s → contagem de novo...
 * Sai da tela: o ciclo pausa onde estiver (contagem, vídeo ou espera); volta: continua.
 * "Repetir vídeo" pula a espera e toca já com som. VSL 25/50/75/95 só no primeiro ciclo.
 */
export default function LipeVideo({ hasVideo, hasPoster }: Props) {
  const card = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef<Set<number>>(new Set());
  const reduced = !!useReducedMotion();

  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState<number | null>(null);
  const [sound, setSound] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);

  const phaseRef = useRef<Phase>("idle");
  const inView = useRef(false);
  const started = useRef(false);
  const pausedByScroll = useRef(false);
  /** Escolha de som da pessoa, mantida entre os ciclos. */
  const soundPref = useRef(false);
  /** Nº do ciclo atual (1 = primeiro). */
  const cycle = useRef(0);
  /** Timer pausável: contagem e espera param quando o card sai da tela. */
  const timer = useRef<{ id: ReturnType<typeof setTimeout> | null; fn: (() => void) | null; due: number; left: number }>({
    id: null,
    fn: null,
    due: 0,
    left: 0,
  });

  const poster = hasPoster ? config.media.lipe.poster : config.media.lipe.placeholder;
  const showVideo = hasVideo && !failed;

  const go = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  /* ---------- timer pausável ---------- */
  const runTimer = () => {
    const t = timer.current;
    t.due = performance.now() + t.left;
    t.id = setTimeout(() => {
      const fn = t.fn;
      t.id = null;
      t.fn = null;
      fn?.();
    }, t.left);
  };
  const clearTimer = () => {
    const t = timer.current;
    if (t.id) clearTimeout(t.id);
    t.id = null;
    t.fn = null;
  };
  const schedule = (fn: () => void, ms: number) => {
    clearTimer();
    timer.current.fn = fn;
    timer.current.left = ms;
    if (inView.current) runTimer();
  };
  const pauseTimer = () => {
    const t = timer.current;
    if (!t.id) return;
    clearTimeout(t.id);
    t.id = null;
    t.left = Math.max(0, t.due - performance.now());
  };
  const resumeTimer = () => {
    if (timer.current.fn && !timer.current.id) runTimer();
  };

  /* ---------- véu preto do fim ---------- */
  const setVeil = (opacity: number, transitionMs = 0) => {
    const veil = veilRef.current;
    if (!veil) return;
    veil.style.transition = transitionMs ? `opacity ${transitionMs}ms ease-out` : "none";
    veil.style.opacity = String(opacity);
  };

  /* ---------- ciclo ---------- */
  const startPlayback = (withSound: boolean) => {
    const v = videoRef.current;
    if (!v) return;
    clearTimer();
    setCount(null);
    setBlocked(false);
    cycle.current += 1;
    setVeil(0);
    v.currentTime = 0;
    v.muted = !withSound;
    setSound(withSound);
    go("playing");
    v.play().catch(() => {
      if (!v.muted) {
        // som sem gesto recente foi bloqueado: segue mudo
        v.muted = true;
        soundPref.current = false;
        setSound(false);
        v.play().catch(onBlocked);
        return;
      }
      onBlocked();
    });
  };

  /** Autoplay bloqueado (ex.: modo economia no iOS): fica na imagem, com botão para ver, sem ciclo. */
  const onBlocked = () => {
    clearTimer();
    setBlocked(true);
    go("rest");
  };

  const tick = (n: number) => {
    setCount(n);
    schedule(() => (n > 1 ? tick(n - 1) : startPlayback(soundPref.current)), TICK_MS);
  };

  const startCountdown = () => {
    go("countdown");
    tick(3);
  };

  const onEnded = () => {
    setVeil(0, VEIL_IN_MS);
    go("rest");
    schedule(startCountdown, REST_MS);
  };

  const onVisibility = (visible: boolean) => {
    inView.current = visible;
    const v = videoRef.current;
    const p = phaseRef.current;
    if (visible) {
      if (p === "idle" && !started.current) {
        started.current = true;
        startCountdown();
        return;
      }
      resumeTimer();
      if (p === "playing" && pausedByScroll.current && v) {
        pausedByScroll.current = false;
        v.play().catch(() => {
          v.muted = true;
          soundPref.current = false;
          setSound(false);
          v.play().catch(() => {});
        });
      }
      return;
    }
    pauseTimer();
    if (p === "playing" && v && !v.paused) {
      v.pause();
      pausedByScroll.current = true;
    }
  };

  const visibilityRef = useRef(onVisibility);
  visibilityRef.current = onVisibility;

  /* Entrada/saída da tela: entra com ~60% visível, sai quando some por completo */
  useEffect(() => {
    const el = card.current;
    if (!el || !showVideo) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.intersectionRatio >= 0.6 && !inView.current) visibilityRef.current(true);
        else if (!e.isIntersecting && inView.current) visibilityRef.current(false);
      },
      { threshold: [0, 0.2, 0.6] },
    );
    io.observe(el);
    const t = timer.current;
    return () => {
      io.disconnect();
      if (t.id) clearTimeout(t.id);
      t.id = null;
      t.fn = null;
    };
  }, [showVideo]);

  /* Fade para preto nos últimos FADE_OUT_S segundos */
  useEffect(() => {
    if (phase !== "playing") return;
    const v = videoRef.current;
    const veil = veilRef.current;
    if (!v || !veil) return;
    let raf = 0;
    const loop = () => {
      // onEnded já assumiu o véu; não sobrescrever antes do cleanup rodar
      if (phaseRef.current !== "playing") return;
      const d = v.duration;
      if (d && isFinite(d)) {
        const o = Math.min(1, Math.max(0, (v.currentTime - (d - FADE_OUT_S)) / FADE_OUT_S));
        veil.style.opacity = String(o);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  /* Eventos VSL 25/50/75/95, só no primeiro ciclo */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (cycle.current !== 1) return;
      if (!v.duration || !isFinite(v.duration)) return;
      const pct = (v.currentTime / v.duration) * 100;
      for (const m of MILESTONES) {
        if (pct >= m && !firedRef.current.has(m)) {
          firedRef.current.add(m);
          trackVsl(m);
        }
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [showVideo]);

  const onRepeat = () => {
    if (!blocked) trackVideoRepetir();
    soundPref.current = true;
    startPlayback(true);
  };

  const onToggleSound = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = v.muted;
    v.muted = !next;
    soundPref.current = next;
    setSound(next);
  };

  const videoVisible = phase === "playing";

  return (
    <div
      ref={card}
      className="relative mx-auto aspect-[9/16] w-full max-w-[380px] overflow-hidden rounded-[28px] bg-ink-2 ring-1 ring-white/10"
    >
      {/* imagem do bordado: estado parado e fundo do fade */}
      <Image src={poster} alt="Close do bordado Stay Alive. no boné" fill sizes="(min-width: 768px) 380px, 90vw" className="object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/5 to-ink/0" />

      {showVideo ? (
        <motion.video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          poster={poster}
          playsInline
          preload="auto"
          muted
          onEnded={onEnded}
          initial={false}
          animate={{ opacity: videoVisible ? 1 : 0 }}
          // some na hora ao terminar (o véu preto já cobre); aparece com fade
          transition={{ duration: videoVisible && !reduced ? 0.6 : 0, ease: "easeOut" }}
          style={{ pointerEvents: videoVisible ? "auto" : "none" }}
        >
          <source src={config.media.lipe.webm} type='video/webm; codecs="vp9, opus"' />
          <source src={config.media.lipe.mp4} type="video/mp4" onError={() => setFailed(true)} />
        </motion.video>
      ) : (
        <span className="label absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">Vídeo em breve</span>
      )}

      {/* véu preto: fade no fim do vídeo e reabre na imagem do bordado */}
      <div ref={veilRef} aria-hidden className="pointer-events-none absolute inset-0 bg-ink opacity-0" />

      {/* contagem 3-2-1 */}
      <AnimatePresence>
        {phase === "countdown" && count !== null ? (
          <motion.div
            key="countdown"
            className="absolute inset-0 flex flex-col items-center justify-center bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className="label">{config.brand.signature} em</span>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={count}
                className="mt-3 text-[96px] font-bold leading-none tracking-[-0.04em]"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.6, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, y: -12 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {count}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Ativar som / desativar */}
      {phase === "playing" && !sound ? (
        <button
          type="button"
          onClick={onToggleSound}
          className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-ink/70 to-ink/0 p-5 pt-16"
          aria-label="Ativar o som do vídeo"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-ink/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white backdrop-blur-md transition-colors hover:bg-white hover:text-ink">
            <SoundIcon muted />
            Ativar som
          </span>
        </button>
      ) : null}
      {phase === "playing" && sound ? (
        <button
          type="button"
          onClick={onToggleSound}
          className="absolute bottom-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-ink/60 text-white backdrop-blur-md transition-colors hover:bg-white hover:text-ink"
          aria-label="Desativar o som do vídeo"
        >
          <SoundIcon muted={false} />
        </button>
      ) : null}

      {/* Repetir vídeo: na espera entre ciclos, pula a espera */}
      <AnimatePresence>
        {phase === "rest" ? (
          <motion.button
            key="repeat"
            type="button"
            onClick={onRepeat}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-ink/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white backdrop-blur-md transition-colors hover:bg-white hover:text-ink"
          >
            <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              {blocked ? (
                <path d="M5 3.5v9l7-4.5-7-4.5z" />
              ) : (
                <>
                  <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
                  <path d="M13.5 2.5v3h-3" />
                </>
              )}
            </svg>
            {blocked ? "Ver vídeo" : "Repetir vídeo"}
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 6v4h2.5L9 13V3L5 6H2.5z" />
      {muted ? (
        <path d="M11.5 6l3 4M14.5 6l-3 4" />
      ) : (
        <>
          <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5" />
          <path d="M13.5 3.5a6 6 0 0 1 0 9" />
        </>
      )}
    </svg>
  );
}
