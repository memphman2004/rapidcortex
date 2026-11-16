"use client";

import Image from "next/image";
import Link from "next/link";
import { MarketingHeroAnimated } from "@/components/marketing/hero/marketing-hero-animated";
import { MARKETING_EVENTS, trackMarketingEvent } from "@/lib/marketing-analytics";
import {
  marketingDashboardPath,
  marketingDemoRequestPath,
} from "@/lib/marketing-links";
import { SITE_NAME, SITE_SLOGAN } from "@/lib/site";

export function HomepageHero() {
  const demoHref = marketingDemoRequestPath("demo");
  const pilotHref = "/free-60-day-pilot";
  const app = marketingDashboardPath();

  return (
    <section className="relative overflow-hidden border-b border-slate-800/80">
      <MarketingHeroAnimated layout="split">
        <div className="grid w-full items-center gap-10 lg:grid-cols-2 lg:gap-12 lg:text-left">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90 drop-shadow-sm">
              NEXCORT iQ&nbsp;&nbsp;|&nbsp;&nbsp;PUBLIC SAFETY TECHNOLOGY
            </p>
            <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-5xl lg:text-[3.5rem] lg:leading-[1.1]">
              AI-Powered Public Safety Intelligence
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-slate-300/95 drop-shadow-sm sm:text-lg">
              {SITE_NAME} is an AI public safety software platform that enhances 911 communications,
              connects existing CAD systems, automates non-emergency workflows, and strengthens
              situational awareness — while keeping public safety professionals in control.
            </p>
            <p className="mt-4 text-base italic text-sky-300/90 drop-shadow-sm sm:text-lg">
              {SITE_SLOGAN}.
            </p>
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:flex-wrap lg:justify-start">
              <Link
                href={demoHref}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500 sm:w-auto sm:text-sm"
                onClick={() => trackMarketingEvent(MARKETING_EVENTS.heroDemoClick)}
              >
                Request a Live Demo
              </Link>
              <Link
                href={pilotHref}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-white/90 bg-transparent px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-white/10 sm:w-auto sm:text-sm"
                onClick={() => trackMarketingEvent(MARKETING_EVENTS.heroPilotClick)}
              >
                Explore the 60-Day Pilot
              </Link>
            </div>
            <p className="mt-6 text-xs text-slate-500">
              Already onboarded?{" "}
              <Link href={app} className="text-sky-400/90 hover:text-sky-300">
                Open the dispatcher workspace
              </Link>
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/60 shadow-[0_30px_80px_-40px_rgba(56,189,248,0.55)] ring-1 ring-white/5 backdrop-blur-sm">
              <Image
                src="/911Marketing.png"
                alt="NexCort iQ dispatcher workspace showing AI-assisted public safety intelligence"
                width={1672}
                height={941}
                priority
                className="h-auto w-full object-contain"
                sizes="(max-width: 1024px) 90vw, 560px"
              />
            </div>
          </div>
        </div>
      </MarketingHeroAnimated>
    </section>
  );
}
