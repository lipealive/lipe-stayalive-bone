"use client";

import { config } from "./config";

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "";
export const isPixelEnabled = META_PIXEL_ID.length > 0;

type FbqFn = (...args: unknown[]) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

/** Dispara um evento padrão do Pixel (PageView, ViewContent...). */
export function trackStandard(event: string, params?: Record<string, unknown>) {
  if (!isPixelEnabled || typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params);
}

/** Dispara um evento customizado (CliqueCheckout, VSL...). */
export function trackCustom(event: string, params?: Record<string, unknown>) {
  if (!isPixelEnabled || typeof window === "undefined" || !window.fbq) return;
  window.fbq("trackCustom", event, params);
}

export function trackViewContent() {
  trackStandard("ViewContent", {
    content_name: config.product.name,
    content_ids: [config.product.sku],
    content_type: "product",
    value: config.product.price,
    currency: config.product.currency,
  });
}

export type CtaPosition = "hero" | "dobra2" | "sticky";

export function trackCliqueCheckout(posicao: CtaPosition) {
  trackCustom("CliqueCheckout", {
    posicao,
    value: config.product.price,
    currency: config.product.currency,
  });
}

export function trackVsl(pct: 25 | 50 | 75 | 95) {
  trackCustom("VSL", { pct });
}

export function trackVideoRepetir() {
  trackCustom("VideoRepetir");
}

const FORWARDED_PARAMS = ["fbclid", "src"];

/**
 * Monta a URL de checkout repassando utm_*, fbclid e src da URL atual.
 * Se o checkout for "#", devolve "#" (sem navegação).
 */
export function buildCheckoutUrl(base: string): string {
  if (!base || base === "#") return "#";
  if (typeof window === "undefined") return base;

  let url: URL;
  try {
    url = new URL(base, window.location.origin);
  } catch {
    return base;
  }

  const current = new URLSearchParams(window.location.search);
  current.forEach((value, key) => {
    if (key.startsWith("utm_") || FORWARDED_PARAMS.includes(key)) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
  });

  return url.toString();
}
