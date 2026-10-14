import type { Metadata, Viewport } from "next";
import { Caveat, Inter_Tight } from "next/font/google";
import { config } from "@/lib/config";
import MetaPixel from "@/components/MetaPixel";
import "lenis/dist/lenis.css";
import "./globals.css";

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(config.seo.url),
  title: config.seo.title,
  description: config.seo.description,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: config.seo.url,
    siteName: config.brand.name,
    title: config.seo.title,
    description: config.seo.description,
    images: [{ url: config.seo.ogImage, width: 1536, height: 1024, alt: config.product.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: config.seo.title,
    description: config.seo.description,
    images: [config.seo.ogImage],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${interTight.variable} ${caveat.variable}`}>
      <body className="bg-ink text-white antialiased">
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
