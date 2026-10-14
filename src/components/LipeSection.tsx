"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { config } from "@/lib/config";
import BuyButton from "./BuyButton";
import LipeVideo from "./LipeVideo";

type Props = { hasVideo: boolean; hasPoster: boolean };

const EASE = [0.22, 1, 0.36, 1] as const;

const TITLE_LINES = ["Feito pra quem", "não para."];

const PARAGRAPHS = [
  "O Stay Alive nasceu da rotina do Lipe: treino cedo, rua, trabalho, mar, montanha. O mesmo dia, vários cenários. Faltava uma peça que atravessasse tudo isso sem pedir licença.",
  "Stay Alive é sobre movimento. É escolher a rotina que te mantém vivo, entre a cidade e a natureza, com liberdade pra ir onde o dia levar. O boné é o lembrete que vai na cabeça.",
];

const BULLETS = [
  { title: "5 panel, perfil baixo", text: "Caimento rente à cabeça. Sem volume, sem exagero." },
  { title: "Aba reta", text: "Linha limpa que segura o visual da cidade à trilha." },
  { title: "Ripstop leve", text: "Tecido texturizado, resistente e respirável. [placeholder: composição do tecido]" },
  { title: "Ajuste traseiro", text: "Tamanho único com regulagem. [placeholder: tipo de fecho — fivela, strap ou cordão]" },
  { title: "Stay Alive. bordado", text: "Bordado branco no painel frontal. Discreto de longe, nítido de perto." },
];

const viewport = { once: true, margin: "-12% 0px" } as const;

export default function LipeSection({ hasVideo, hasPoster }: Props) {
  const reduced = !!useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start end", "end start"] });
  const videoY = useTransform(scrollYProgress, [0, 1], [40, -40]);

  return (
    <section ref={section} id="lipe" className="relative bg-ink px-5 pb-20 pt-10 md:py-32">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 md:grid-cols-2 md:gap-16 lg:gap-24">
        {/* Vídeo: primeiro no mobile, à direita no desktop. Clip-path expande + parallax leve */}
        <motion.div
          className="order-1 md:order-2"
          style={reduced ? undefined : { y: videoY }}
          initial={reduced ? false : { clipPath: "inset(16% 12% 16% 12% round 44px)", opacity: 0.6 }}
          whileInView={{ clipPath: "inset(0% 0% 0% 0% round 28px)", opacity: 1 }}
          viewport={viewport}
          transition={{ duration: 1.2, ease: EASE }}
        >
          <LipeVideo hasVideo={hasVideo} hasPoster={hasPoster} />
        </motion.div>

        <div className="order-2 md:order-1">
          <motion.span
            className="label block"
            initial={reduced ? false : { opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewport}
            transition={{ duration: 0.6, ease: EASE }}
          >
            O Lipe · O boné
          </motion.span>

          {/* Título: reveal por linha com máscara */}
          <motion.h2
            className="mt-4 text-[38px] font-bold leading-[1.0] tracking-[-0.035em] md:text-6xl"
            initial="hidden"
            whileInView="show"
            viewport={viewport}
          >
            {TITLE_LINES.map((line, i) => (
              <span key={line} className="block overflow-hidden pb-[0.06em]">
                <motion.span
                  className="block"
                  variants={{
                    hidden: reduced ? { y: 0 } : { y: "110%" },
                    show: { y: 0, transition: { duration: 0.9, delay: 0.08 + i * 0.12, ease: EASE } },
                  }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </motion.h2>

          {/* Parágrafos com stagger */}
          <motion.div
            className="mt-6 space-y-4 text-[15px] leading-relaxed text-white/65 md:text-base"
            initial={reduced ? "hidden" : "hidden"}
            whileInView="show"
            viewport={viewport}
            variants={{ hidden: {}, show: { transition: { staggerChildren: reduced ? 0 : 0.14, delayChildren: reduced ? 0 : 0.3 } } }}
          >
            {PARAGRAPHS.map((p) => (
              <motion.p
                key={p.slice(0, 16)}
                variants={{ hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } } }}
              >
                {p}
              </motion.p>
            ))}
          </motion.div>

          {/* Bullets um a um, com a divisória se desenhando */}
          <ul className="mt-8">
            {BULLETS.map((b, i) => (
              <motion.li
                key={b.title}
                className="relative"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-8% 0px" }}
                transition={{ delayChildren: reduced ? 0 : i * 0.08 }}
              >
                <motion.span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-px origin-left bg-white/15"
                  variants={{ hidden: reduced ? { scaleX: 1 } : { scaleX: 0 }, show: { scaleX: 1, transition: { duration: 0.9, ease: EASE } } }}
                />
                <motion.div
                  className="flex gap-4 py-4"
                  variants={{ hidden: reduced ? { opacity: 1 } : { opacity: 0, x: -12 }, show: { opacity: 1, x: 0, transition: { duration: 0.6, delay: 0.15, ease: EASE } } }}
                >
                  <span aria-hidden className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-white/70" />
                  <div>
                    <p className="text-sm font-semibold tracking-[0.01em]">{b.title}</p>
                    <p className="mt-0.5 text-sm text-white/55">{b.text}</p>
                  </div>
                </motion.div>
                {i === BULLETS.length - 1 ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-white/15" /> : null}
              </motion.li>
            ))}
          </ul>

          <motion.div
            className="mt-8 flex flex-col items-start"
            initial={reduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewport}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
          >
            <div className="flex items-baseline gap-3">
              <span className="text-xl font-semibold tracking-[-0.02em]">{config.product.priceLabel}</span>
              <span className="text-sm text-white/50">{config.product.installmentsLabel}</span>
            </div>
            <BuyButton id="cta-dobra2" posicao="dobra2" className="mt-4" />
            <p className="mt-3 text-xs tracking-[0.04em] text-white/45">{config.cta.microcopy}</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
