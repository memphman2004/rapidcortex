import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { absoluteUrl, buildOrganizationJsonLd } from "@/lib/seo";

const CORE_HERO = {
  src: "/images/911-hero.webp",
  width: 1672,
  height: 941,
  alt: "Rapid Cortex Core — 911 dispatch floor, live transcription, and emergency response coordination",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "RC Core | Rapid Cortex",
    description:
      "Rapid Cortex Core provides AI-assisted situational awareness and incident intelligence for 911, EMS, fire rescue, and law enforcement operations.",
    keywords: [
      "911 software",
      "dispatch intelligence",
      "EMS dispatch software",
      "fire rescue command",
      "law enforcement incident management",
    ],
    openGraph: {
      title: "RC Core | Rapid Cortex",
      description: "Intelligence at the speed of response for core public safety operations.",
      url: absoluteUrl("/product/core"),
      siteName: "Rapid Cortex",
      images: [
        {
          url: absoluteUrl(CORE_HERO.src),
          width: CORE_HERO.width,
          height: CORE_HERO.height,
          alt: "Rapid Cortex Core",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "RC Core | Rapid Cortex",
      description: "AI-assisted public safety intelligence for dispatch operations.",
      images: [absoluteUrl(CORE_HERO.src)],
    },
    alternates: { canonical: absoluteUrl("/product/core") },
  };
}

export default function ProductCorePage() {
  const organizationJsonLd = buildOrganizationJsonLd();
  return (
    <article className="w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />

      <section
        aria-labelledby="core-hero-title"
        className="relative isolate w-full overflow-hidden bg-slate-950"
      >
        <div className="relative aspect-[1672/941] w-full min-h-[min(56vh,34rem)] sm:min-h-[min(62vh,40rem)]">
          <Image
            src={CORE_HERO.src}
            alt={CORE_HERO.alt}
            width={CORE_HERO.width}
            height={CORE_HERO.height}
            priority
            unoptimized
            className="absolute inset-0 h-full w-full object-cover object-[58%_center] sm:object-center"
            sizes="100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/80"
            aria-hidden
          />
          <div className="relative z-10 flex h-full w-full flex-col items-start justify-start px-4 pb-8 pt-2 text-left sm:px-6 sm:pb-10 sm:pt-3 lg:px-8">
            <div className="max-w-2xl space-y-3 sm:space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">RC Core</p>
              <h1
                id="core-hero-title"
                className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl"
              >
                Intelligence at the Speed of Response
              </h1>
              <p className="max-w-md text-pretty text-sm leading-relaxed text-slate-200 sm:text-base">
                Built for 911 PSAP, EMS, fire rescue, and law enforcement teams that need coordinated
                decision-support under high-pressure incident conditions.
              </p>
              <div className="flex flex-wrap justify-start gap-3 pt-1">
                <Link
                  href="https://www.rapidcortex.us/contact-sales?interest=demo"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-500"
                >
                  Request a Demo
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/25 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:border-white/40 hover:bg-slate-900/60"
                >
                  View plans
                </Link>
              </div>
              <section className="pt-2 sm:pt-3">
                <h2 className="text-base font-medium text-white sm:text-lg">Core capabilities</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                  <li>Live call intelligence</li>
                  <li>AI triage support</li>
                  <li>Transcription and translation</li>
                  <li>Caller media intake</li>
                  <li>CAD integration</li>
                  <li>Supervisor QA workflows</li>
                  <li>Incident command coordination</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <section id="transcription">
          <h2 className="text-xl font-medium text-white">Transcription support</h2>
          <p className="mt-2 text-sm text-slate-300">
            RC Core provides live transcription workflows that help dispatch and supervisory teams retain critical
            context during active incidents.
          </p>
        </section>

        <section id="supervisor" className="mt-10">
          <h2 className="text-xl font-medium text-white">Supervisor visibility</h2>
          <p className="mt-2 text-sm text-slate-300">
            Supervisor-focused dashboards provide incident and queue awareness without replacing human command
            oversight.
          </p>
        </section>

        <section className="mt-10 rounded-lg border border-slate-800 bg-slate-900/30 p-4">
          <h2 className="text-lg font-medium text-white">Decision-support disclaimer</h2>
          <p className="mt-2 text-sm text-slate-300">
            Rapid Cortex is a decision-support tool. It does not replace dispatcher judgment, CAD systems, medical
            direction, or established protocols.
          </p>
        </section>
      </div>
    </article>
  );
}
