import { PricingHeroNeuralCanvas } from "./pricing-hero-neural-canvas";
import { PricingHeroCtas } from "./pricing-hero-ctas";

export function PricingHero() {
  return (
    <header className="relative min-h-[clamp(320px,48dvh,560px)] overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0a0f1e] shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)] sm:rounded-3xl">
      <PricingHeroNeuralCanvas className="z-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-[#0a0f1e]/92 via-[#0a0f1e]/50 to-[#0a0f1e]/25"
      />
      <div className="pointer-events-none relative z-10 flex min-h-[clamp(320px,48dvh,560px)] flex-col justify-center px-4 py-6 sm:px-10 sm:py-8">
        <div className="pointer-events-auto mx-0 w-full max-w-3xl items-start self-start text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90 drop-shadow-sm">
            Plans & monetization
          </p>
          <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white drop-shadow-md sm:text-4xl md:text-[2.35rem] md:leading-tight">
            Flexible Plans for Public Safety Agencies
          </h1>
          <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-300/95 drop-shadow-sm sm:text-lg">
            Choose Rapid Cortex as a full command platform, RC Lite (API-only or add-on), or an enterprise deployment
            built around your agency’s needs. Pricing is based on agency size, usage, integrations, support level,
            and deployment requirements—monthly, annual, pilot, and government invoice options are available.
          </p>
          <PricingHeroCtas />
        </div>
      </div>
    </header>
  );
}
