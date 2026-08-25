import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { absoluteUrl, buildOrganizationJsonLd } from "@/lib/seo";

const CAMPUS_HERO = {
  src: "/images/campus-hero.webp",
  width: 1672,
  height: 941,
  alt: "Rapid Cortex Campus — emergency tower, campus safety operations, and intelligence overlays at night",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "RC Campus | Rapid Cortex",
    description:
      "Rapid Cortex Campus brings incident coordination and communications intelligence to university and K-12 safety operations.",
    keywords: [
      "campus safety software",
      "university emergency communications",
      "k-12 safety platform",
      "campus dispatch",
      "campus incident reporting",
    ],
    openGraph: {
      title: "RC Campus | Rapid Cortex",
      description: "Safety intelligence for every campus.",
      url: absoluteUrl("/product/campus"),
      siteName: "Rapid Cortex",
      images: [
        {
          url: absoluteUrl(CAMPUS_HERO.src),
          width: CAMPUS_HERO.width,
          height: CAMPUS_HERO.height,
          alt: "Rapid Cortex Campus",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "RC Campus | Rapid Cortex",
      description: "Campus safety intelligence for universities and K-12 teams.",
      images: [absoluteUrl(CAMPUS_HERO.src)],
    },
    alternates: { canonical: absoluteUrl("/product/campus") },
  };
}

export default function ProductCampusPage() {
  const organizationJsonLd = buildOrganizationJsonLd();
  return (
    <article className="w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />

      {/* Full-bleed hero — edge-to-edge CampusMarketing visual */}
      <section
        aria-labelledby="campus-hero-title"
        className="relative isolate w-full overflow-hidden bg-slate-950"
      >
        <div className="relative aspect-[1672/941] w-full min-h-[min(56vh,34rem)] sm:min-h-[min(62vh,40rem)]">
          <Image
            src={CAMPUS_HERO.src}
            alt={CAMPUS_HERO.alt}
            width={CAMPUS_HERO.width}
            height={CAMPUS_HERO.height}
            priority
            unoptimized
            className="absolute inset-0 h-full w-full object-cover object-[72%_center] sm:object-center"
            sizes="100vw"
          />
          {/* Full-width readability wash — copy sits top-left over the hero */}
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/80"
            aria-hidden
          />
          <div className="relative z-10 flex h-full w-full flex-col items-start justify-start px-4 pb-8 pt-2 text-left sm:px-6 sm:pb-10 sm:pt-3 lg:px-8">
            <div className="max-w-2xl space-y-3 sm:space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">RC Campus</p>
              <h1
                id="campus-hero-title"
                className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl"
              >
                Safety Intelligence for Every Campus
              </h1>
              <p className="max-w-md text-pretty text-sm leading-relaxed text-slate-200 sm:text-base">
                Built for university campus police, K-12 safety officers, and emergency management
                coordinators.
              </p>
              <div className="flex flex-wrap justify-start gap-3 pt-1">
                <Link
                  href="https://www.rapidcortex.us/contact-sales?interest=demo"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-500"
                >
                  Talk to Campus Sales
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
                  <li>Incident coordination</li>
                  <li>Real-time communications intelligence</li>
                  <li>Officer dispatch support</li>
                  <li>Building access monitoring workflows</li>
                  <li>Service call management</li>
                  <li>Operational reporting</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
