import { config } from "@/lib/config";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-white/10 px-5 py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
        <span className="text-lg font-bold tracking-[-0.02em]">{config.brand.signature}</span>
        <a
          href={config.brand.instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="label transition-colors hover:text-white"
        >
          {config.brand.instagram}
        </a>
        <span className="text-xs text-white/40">
          © {year} {config.brand.name}
        </span>
      </div>
    </footer>
  );
}
