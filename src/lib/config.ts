/**
 * Configuração central da landing page.
 * Tudo que muda com frequência (preço, textos, mídias, checkout) fica aqui.
 */

export type HeroMode = "video" | "3d";

const checkoutUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL?.trim() || "#";

export const config = {
  brand: {
    name: "Lipe Alive",
    signature: "Stay Alive.",
    instagram: "@lipe.alive",
    instagramUrl: "https://instagram.com/lipe.alive",
  },

  product: {
    name: "Boné Stay Alive",
    shortName: "Stay Alive",
    /** Preço cheio (número usado no ViewContent). */
    price: 149.9,
    priceLabel: "R$ 149,90",
    installmentsLabel: "ou 3x de R$ 49,97 sem juros",
    currency: "BRL",
    sku: "bone-stay-alive-5panel-preto",
  },

  cta: {
    label: "Pega a senha",
    microcopy: "Envio para todo o Brasil · Pagamento seguro",
    /** Lido de NEXT_PUBLIC_CHECKOUT_URL. "#" = botão visível, mas não navega. */
    checkoutUrl,
  },

  hero: {
    /** "video" (padrão) ou "3d". */
    mode: "3d" as HeroMode,
    eyebrow: "Lipe Alive · 5 Panel",
    title: "Stay Alive.",
    subtitle: "O boné de quem vive em movimento.",
  },

  media: {
    bone: {
      webm: "/media/bone/bone-360.webm",
      mp4: "/media/bone/bone-360.mp4",
      poster: "/media/bone/bone-poster.jpg",
      glb: "/media/bone/bone.glb",
      /** Imagem provisória (recorte do storyboard) usada até as mídias chegarem. */
      placeholder: "/media/img/placeholder-bone.jpg",
    },
    lipe: {
      webm: "/media/video/lipe.webm",
      mp4: "/media/video/lipe.mp4",
      poster: "/media/video/lipe-poster.jpg",
      placeholder: "/media/img/placeholder-lipe.jpg",
    },
  },

  /** Seção "Sobre o Lipe" (mesmos dados da LP Alive Finance). */
  lipe: {
    name: "Lipe",
    handle: "@lipe.alive",
    instagram: "https://www.instagram.com/lipe.alive/",
    youtube: "https://www.youtube.com/@LipeAlive",
    tagline: "O irmão mais velho que você não teve.",
    line: "Engenheiro civil pela UFBA, fala sobre sair da zona de conforto e assumir o controle da própria vida — inclusive do dinheiro.",
    stats: [
      { value: 1.7, decimals: 1, unit: "mi", label: "no Instagram", href: "https://www.instagram.com/lipe.alive/" },
      { value: 44.9, decimals: 1, unit: "mil", label: "no YouTube", href: "https://www.youtube.com/@LipeAlive" },
    ],
    signature: "Stay Alive",
    photo: "/media/img/lipe/lipe-casual.png",
    logo: "/media/img/lipe/horn-lipe-branco.png",
  },

  seo: {
    title: "Boné Stay Alive · Lipe Alive",
    description:
      "O boné 5 panel preto do Lipe. Perfil baixo, aba reta, ripstop e o Stay Alive. bordado na frente. Pega a senha.",
    url: "https://stayalive.com.br",
    ogImage: "/media/img/storyboard.png",
  },
} as const;

export const isCheckoutReady = config.cta.checkoutUrl !== "#";
