"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { config } from "@/lib/config";
import { trackVideoRepetir, trackVsl } from "@/lib/tracking";

type Props = { hasVideo: boolean; hasPoster: boolean };
type State = "idle" | "countdown" | "playing" | "ended";

const MILESTONES = [25, 50, 75, 95] as const;

/**
 * Card do vídeo do Lipe.
 * Parado: imagem do bordado. Ao entrar ~60% na tela: contagem 3-2-1 e o vídeo começa mudo.
 * Ao terminar: volta para a imagem com "Repetir vídeo" (repete já com som).
 * Sai da tela no meio: pausa; volta: continua.
 */
export default function LipeVideo({ hasVideo, hasPoster }: Props) {
  const card = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const firedRef = useRef<Set<number>>(new Set());
  const reduced = !!useReducedMotion();

  const [state, setState] = useState<State>("idle");
  const [count, setCount] = useState<number | null>(null);
  const [sound, setSound] = useState(false);
  const [failed, setFailed] = useState(false);
  const stateRef = useRef<State>("idle");
  stateRef.current = state;
  const pausedByScroll = useRef(false);
  const playedOnce = useRef(false);
  const countdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poster = hasPoster ? config.media.lipe.poster : config.media.lipe.placeholder;
  const showVideo = hasVideo && !failed;

  const clearCountdown = () => {
    if (countdownTimer.current) clearTimeout(countdownTimer.current);
    countdownTimer.current = null;
  };

  const startPlayback = useCallback(
    (withSound: boolean) => {
      const v = videoRef.current;
      if (!v) return;
      v.muted = !withSound;
      setSound(withSound);
      v.currentTime = 0;
      playedOnce.current = true;
      setState("playing");
      v.play().catch(() => {
        // autoplay bloqueado: volta para a imagem, sem erro visível
        setState("idle");
      });
    },
    [],
  );

  const startCountdown = useCallback(() => {
    setState("countdown");
    const tick = (n: number) => {
      setCount(n);
      if (n <= 1) {
        countdownTimer.current = setTimeout(() => {
          setCount(null);
          startPlayback(false);
        }, 900);
        return;
      }
      countdownTimer.current = setTimeout(() => tick(n - 1), 900);
    };
    tick(3);
  }, [startPlayback]);

  /* Entrada/saída da tela */
  useEffect(() => {
    const el = card.current;
    if (!el || !showVideo) return;
    const io = new IntersectionObserver(
      ([e]) => {
        const v = videoRef.current;
        const st = stateRef.current;
        if (e.intersectionRatio >= 0.6 && st === "idle" && !playedOnce.current) {
          startCountdown();
          return;
        }
        if (!e.isIntersecting) {
          if (st === "countdown") {
            clearCountdown();
            setCount(null);
            setState("idle");
          } else if (st === "playing" && v && !v.paused) {
            v.pause();
            pausedByScroll.current = true;
          }
          return;
        }
        if (e.isIntersecting && st === "playing" && pausedByScroll.current && v) {
          pausedByScroll.current = false;
          v.play().catch(() => {});
        }
      },
      { threshold: [0, 0.2, 0.6] },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clearCountdown();
    };
  }, [showVideo, startCountdown]);

  /* Eventos VSL 25/50/75/95 */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
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

  const onEnded = () => setState("ended");

  const onRepeat = () => {
    trackVideoRepetir();
    startPlayback(true);
  };

  const onEnableSound = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setSound(true);
  };

  const videoVisible = state === "playing";

  return (
    <div
      ref={card}
      className="relative mx-auto aspect-[9/16] w-full max-w-[380px] overflow-hidden rounded-[28px] bg-ink-2 ring-1 ring-white/10"
    >
      {/* imagem do bordado: estado parado e fundo do fade */}
      <Image src={poster} alt="Lipe com o boné Stay Alive" fill sizes="(min-width: 768px) 380px, 90vw" className="object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/5 to-ink/0" />

      {showVideo ? (
        <motion.video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={config.media.lipe.mp4}
          poster={poster}
          playsInline
          preload="auto"
          muted
          onEnded={onEnded}
          onError={() => setFailed(true)}
          initial={false}
          animate={{ opacity: videoVisible ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.6, ease: "easeOut" }}
          style={{ pointerEvents: videoVisible ? "auto" : "none" }}
        />
      ) : (
        <span className="label absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap">Vídeo em breve</span>
      )}

      {/* contagem 3-2-1 */}
      <AnimatePresence>
        {state === "countdown" && count !== null ? (
          <motion.div
            key="countdown"
            className="absolute inset-0 flex flex-col items-center justify-center bg-ink/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className="label">O vídeo começa em</span>
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

      {/* Ativar som */}
      {state === "playing" && !sound ? (
        <button
          type="button"
          onClick={onEnableSound}
          className="absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-ink/70 to-ink/0 p-5 pt-16"
          aria-label="Ativar o som do vídeo"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-ink/60 px-4 py-2 text-xs font-medium uppercase tracking-[0.2em] text-white backdrop-blur-md transition-colors hover:bg-white hover:text-ink">
            <SoundIcon muted />
            Ativar som
          </span>
        </button>
      ) : null}

      {/* Repetir vídeo */}
      <AnimatePresence>
        {state === "ended" ? (
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
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
              <path d="M13.5 2.5v3h-3" />
            </svg>
            Repetir vídeo
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
