"use client";

import Image from "next/image";
import { useState } from "react";
import clsx from "clsx";
import { config } from "@/lib/config";

export type BoneSpinProps = {
  /** Flags calculadas no servidor: as mídias existem em /public? */
  hasVideo: boolean;
  hasPoster: boolean;
  hasGlb: boolean;
  className?: string;
};

/** Placeholder elegante (recorte do storyboard) usado enquanto as mídias não existem. */
export function BonePlaceholder({ hint }: { hint?: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px]">
      <Image
        src={config.media.bone.placeholder}
        alt={config.product.name}
        fill
        priority
        sizes="(min-width: 768px) 420px, 80vw"
        className="object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/0 via-ink/0 to-ink" />
      {hint ? (
        <span className="label absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap">{hint}</span>
      ) : null}
    </div>
  );
}

/** Modo "video": <video> 360° (o modo "3d" é a cena em hero3d/Scene.tsx). */
export default function BoneSpin({ hasVideo, hasPoster, className }: Omit<BoneSpinProps, "hasGlb">) {
  const [videoFailed, setVideoFailed] = useState(false);

  const frame = clsx(
    "relative mx-auto aspect-[3/4] w-[min(80vw,360px)] md:w-[420px] lg:w-[460px]",
    className,
  );

  const showVideo = hasVideo && !videoFailed;

  return (
    <div className={frame} data-mode="video">
      {showVideo ? (
        <video
          className="h-full w-full rounded-[28px] object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={hasPoster ? config.media.bone.poster : config.media.bone.placeholder}
          aria-label={`${config.product.name} girando em 360°`}
          onError={() => setVideoFailed(true)}
        >
          <source src={config.media.bone.webm} type="video/webm" />
          <source src={config.media.bone.mp4} type="video/mp4" />
        </video>
      ) : (
        <BonePlaceholder />
      )}
    </div>
  );
}
