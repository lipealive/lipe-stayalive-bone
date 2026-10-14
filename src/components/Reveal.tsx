"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

type RevealProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
  /** Anima ao entrar na viewport (padrão) ou imediatamente na montagem. */
  once?: boolean;
  immediate?: boolean;
};

/** Entrada discreta (fade + leve subida). Respeita prefers-reduced-motion. */
export default function Reveal({
  delay = 0,
  y = 16,
  immediate = false,
  children,
  ...rest
}: RevealProps) {
  const reduce = useReducedMotion();
  const hidden = reduce ? { opacity: 1, y: 0 } : { opacity: 0, y };
  const visible = { opacity: 1, y: 0 };
  const transition = { duration: reduce ? 0 : 0.7, delay: reduce ? 0 : delay, ease: [0.22, 1, 0.36, 1] as const };

  if (immediate) {
    return (
      <motion.div initial={hidden} animate={visible} transition={transition} {...rest}>
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={hidden}
      whileInView={visible}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={transition}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
