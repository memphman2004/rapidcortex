import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { absoluteUrl, buildOrganizationJsonLd } from "@/lib/seo";

const VENUE_HERO = {
  src: "/VenueMarketing.png",
  width: 1672,
  height: 941,
  alt: "Rapid Cortex Venue Command — stadium security operations, help tower, and live camera feeds at night",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "RC Venue | Rapid Cortex",
    description:
      "Rapid Cortex Venue provides command-level awareness for stadium, arena, and event security operations.",
    keywords: [
      "venue security software",
      "stadium command platform",
      "event operations software",
      "crowd monitoring tools",
      "venue incident coordination",
    ],
    openGraph: {
      title: "RC Venue | Rapid Cortex",
      description: "Command-level awareness for every event.",
      url: absoluteUrl("/product/venue"),
      siteName: "Rapid Cortex",
      images: [
        {
          url: absoluteUrl(VENUE_HERO.src),
          width: VENUE_HERO.width,
          height: VENUE_HERO.height,
          alt: "Rapid Cortex Venue",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "RC Venue | Rapid Cortex",
      description: "Venue and event command intelligence for security teams.",
      images: [absoluteUrl(VENUE_HERO.src)],
    },
    alternates: { canonical: absoluteUrl("/product/venue") },
  };
}

export default function ProductVenuePage() {
  const organizationJsonLd = buildOrganizationJsonLd();
  return (
    <article className="w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />

      <section
        aria-labelledby="venue-hero-title"
        className="relative isolate w-full overflow-hidden bg-slate-950"
      >
        <div className="relative aspect-[1672/941] w-full min-h-[min(56vh,34rem)] sm:min-h-[min(62vh,40rem)]">
          <Image
            src={VENUE_HERO.src}
            alt={VENUE_HERO.alt}
            width={VENUE_HERO.width}
            height={VENUE_HERO.height}
            priority
            unoptimized
            className="absolute inset-0 h-full w-full object-cover object-[68%_center] sm:object-center"
            sizes="100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/80"
            aria-hidden
          />
          <div className="relative z-10 flex h-full w-full flex-col items-start justify-start px-4 pb-8 pt-2 text-left sm:px-6 sm:pb-10 sm:pt-3 lg:px-8">
            <div className="max-w-2xl space-y-3 sm:space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">RC Venue</p>
              <h1
                id="venue-hero-title"
                className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl"
              >
                Command-Level Awareness for Every Event
              </h1>
              <p className="max-w-md text-pretty text-sm leading-relaxed text-slate-200 sm:text-base">
                Designed for venue security directors, event operations teams, and stadium command staff.
              </p>
              <div className="flex flex-wrap justify-start gap-3 pt-1">
                <Link
                  href="https://www.rapidcortex.us/contact-sales?interest=demo"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-orange-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-950/40 hover:bg-orange-500"
                >
                  Talk to Venue Sales
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/25 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm hover:border-white/40 hover:bg-slate-900/60"
                >
                  View plans
                </Link>
              </div>
              <section className="pt-2 sm:pt-3">
                <h2 className="text-base font-medium text-white sm:text-lg">Key capabilities</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                  <li>Crowd density monitoring</li>
                  <li>Gate access control operations</li>
                  <li>Unit tracking support</li>
                  <li>Incident coordination</li>
                  <li>Event operations workflows</li>
                  <li>Post-event reporting</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
