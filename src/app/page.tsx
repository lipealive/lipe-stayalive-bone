import { Suspense } from "react";
import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import Hero from "@/components/Hero";
import LipeSection from "@/components/LipeSection";
import Footer from "@/components/Footer";
import LipeAbout from "@/components/LipeAbout";
import Marquee from "@/components/Marquee";
import SmoothScroll from "@/components/SmoothScroll";
import StickyBuyBar from "@/components/StickyBuyBar";

/** Verifica em build time se a mídia existe em /public (evita 404 e mostra placeholder). */
function publicExists(publicPath: string) {
  return fs.existsSync(path.join(process.cwd(), "public", publicPath));
}

export default function Page() {
  const bone = config.media.bone;
  const lipe = config.media.lipe;

  const flags = {
    hasVideo: publicExists(bone.webm) || publicExists(bone.mp4),
    hasPoster: publicExists(bone.poster),
    hasGlb: publicExists(bone.glb),
  };

  return (
    <main>
      <SmoothScroll />
      <Hero {...flags} />
      {/* Sobe por cima do hero enquanto o boné sai (sobreposição, sem scroll vazio) */}
      {/* Suspense abaixo da dobra: hidratação seletiva, em tarefas separadas do hero */}
      <div className="relative z-20 -mt-[26svh] motion-reduce:mt-0">
        <Suspense fallback={null}>
          <Marquee />
        </Suspense>
        <Suspense fallback={null}>
          <LipeSection hasVideo={publicExists(lipe.mp4)} hasPoster={publicExists(lipe.poster)} />
        </Suspense>
        <Suspense fallback={null}>
          <LipeAbout />
          <Footer />
        </Suspense>
      </div>
      <StickyBuyBar />
    </main>
  );
}
