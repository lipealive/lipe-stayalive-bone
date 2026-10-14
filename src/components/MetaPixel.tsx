"use client";

import Script from "next/script";
import { useEffect } from "react";
import { META_PIXEL_ID, isPixelEnabled, trackViewContent } from "@/lib/tracking";

/**
 * Meta Pixel. Só renderiza se NEXT_PUBLIC_META_PIXEL_ID estiver preenchido.
 * PageView é disparado no init; ViewContent logo após, com value = preço.
 */
export default function MetaPixel() {
  useEffect(() => {
    if (!isPixelEnabled) return;
    // Se o script já carregou (navegação client-side), dispara direto.
    if (window.fbq) trackViewContent();
  }, []);

  if (!isPixelEnabled) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        onLoad={() => trackViewContent()}
        dangerouslySetInnerHTML={{
          __html: `
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
