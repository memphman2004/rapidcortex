import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { absoluteUrl, buildOrganizationJsonLd } from "@/lib/seo";

const TRANSIT_HERO = {
  src: "/images/transit-hero.webp",
  width: 1672,
  height: 941,
  alt: "NexCort iQ Transit — connected fleet, route, and station operations intelligence",
} as const;

const TRANSIT_OG_IMAGE_SRC = "/images/transit-og.jpg";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Transit | NexCort iQ",
    description:
      "NexCort iQ Transit connects fleet, route, and station operations for bus, rail, and ferry agencies — alongside existing transit security and 911.",
    keywords: [
      "transit safety software",
      "transit operations platform",
      "bus rail ferry security",
      "fleet incident coordination",
      "transit QR NFC reporting",
    ],
    openGraph: {
      title: "Transit | NexCort iQ",
      description: "Connected operations for every vehicle, every route, every run.",
      url: absoluteUrl("/product/transit"),
      siteName: "NexCort iQ",
      images: [
        {
          url: absoluteUrl(TRANSIT_OG_IMAGE_SRC),
          width: TRANSIT_HERO.width,
          height: TRANSIT_HERO.height,
          alt: "NexCort iQ Transit",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Transit | NexCort iQ",
      description: "Fleet, route, and station operations intelligence for transit agencies.",
      images: [absoluteUrl(TRANSIT_OG_IMAGE_SRC)],
    },
    alternates: { canonical: absoluteUrl("/product/transit") },
  };
}

export default function ProductTransitPage() {
  const organizationJsonLd = buildOrganizationJsonLd();
  return (
    <article className="w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />

      <section
        aria-labelledby="transit-hero-title"
        className="relative isolate w-full overflow-hidden bg-slate-950"
      >
        <div className="relative aspect-[1672/941] w-full min-h-[min(56vh,34rem)] sm:min-h-[min(62vh,40rem)]">
          <Image
            src={TRANSIT_HERO.src}
            alt={TRANSIT_HERO.alt}
            width={TRANSIT_HERO.width}
            height={TRANSIT_HERO.height}
            priority
            unoptimized
            className="absolute inset-0 h-full w-full object-cover object-center"
            sizes="100vw"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/75 via-slate-950/55 to-slate-950/80"
            aria-hidden
          />
          <div className="relative z-10 flex h-full w-full flex-col items-start justify-start px-4 pb-8 pt-2 text-left sm:px-6 sm:pb-10 sm:pt-3 lg:px-8">
            <div className="max-w-2xl space-y-3 sm:space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-300">Transit</p>
              <h1
                id="transit-hero-title"
                className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl"
              >
                Connected operations for every vehicle, every route, every run
              </h1>
              <p className="max-w-md text-pretty text-sm leading-relaxed text-slate-200 sm:text-base">
                Built for transit agencies, fleet supervisors, and station security — not a 911 PSAP
                console. Works alongside existing transit ops and emergency communications.
              </p>
              <div className="flex flex-wrap justify-start gap-3 pt-1">
                <Link
                  href="https://www.nexcortiq.us/contact-sales?interest=demo"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/40 hover:bg-blue-500"
                >
                  Talk to Transit Sales
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
                  <li>Fleet and route operations visibility</li>
                  <li>Incident coordination across vehicles and stations</li>
                  <li>QR/NFC rider and staff reporting</li>
                  <li>Camera registry and live view workflows</li>
                  <li>Operator vehicle assignment support</li>
                  <li>Operational reporting and audit trail</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="transit-related-heading">
        <h2 id="transit-related-heading" className="text-lg font-semibold text-white">
          Related resources
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: "/integrations", label: "Integrations overview" },
            { href: "/product", label: "All product lines" },
            { href: "/free-60-day-pilot", label: "Free 60-Day Pilot" },
            { href: "/contact-sales?interest=demo", label: "Contact sales" },
          ].map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-md border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-900/70"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
