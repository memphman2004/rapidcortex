import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, QrCode, ShieldCheck } from "lucide-react";
import { buildPublicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildPublicPageMetadata({
    title: "Rapid Cortex Venue | Stadium & Venue Safety Intelligence Platform",
    description:
      "Rapid Cortex Venue helps stadiums, arenas, airports, and universities coordinate guest assistance and security incidents with QR code reporting, SMS reporting, real-time security dashboards, and optional escalation to emergency communications.",
    path: "/venue",
  }),
  alternates: {
    canonical: "https://www.rapidcortex.us/venue",
  },
};

const venueSoftwareJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Rapid Cortex Venue",
  applicationCategory: "BusinessApplication",
  url: "https://www.rapidcortex.us/venue",
  description:
    "Venue safety and incident coordination platform for stadiums, arenas, airports, universities, and large venues. Guests report via QR code or SMS. Security teams manage incidents through a unified dashboard with location, media, and camera references.",
  offers: {
    "@type": "Offer",
    name: "Free 60-Day Pilot Program",
    price: "0",
    priceCurrency: "USD",
  },
  provider: {
    "@type": "Organization",
    name: "Rapid Cortex",
    url: "https://www.rapidcortex.us",
  },
};

const featureCards = [
  {
    Icon: QrCode,
    title: "QR Code Reporting",
    body: "Guests scan a QR code posted at any zone or section. The report is instantly routed to your security dashboard with location, message, photo, and video — no app download required.",
  },
  {
    Icon: MessageSquare,
    title: "SMS Reporting",
    body: "Guests text a venue code and their location to a shared Rapid Cortex safety number. Rapid Cortex parses the venue, location, and message and routes the incident to your team in seconds. Example: MBS Medical Emergency Section 124 → 723389",
  },
  {
    Icon: ShieldCheck,
    title: "Security Dashboard",
    body: "Every report creates a tracked incident with location, media, nearby camera references, and a full audit trail. Security can assign personnel, chat on the incident, and escalate to Rapid Cortex Core for emergency communications coordination.",
  },
] as const;

const venueTypes = [
  "Stadiums & Arenas",
  "Airports",
  "Universities & Campuses",
  "Hospitals",
  "Convention Centers",
  "Large Corporate Campuses",
] as const;

export default function MarketingVenuePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(venueSoftwareJsonLd) }}
      />

      <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        Venue Safety Intelligence at the Speed of Response
      </h1>
      <p className="mt-5 max-w-3xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
        Rapid Cortex Venue helps security teams at stadiums, arenas, airports, universities, and large venues
        coordinate guest assistance and incident response — without replacing your security team, radios, or
        camera systems.
      </p>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white sm:text-2xl">How it works</h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featureCards.map((card) => (
            <li key={card.title} className="rounded-lg border border-slate-800 bg-slate-900/30 p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300">
                <card.Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-sky-200">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{card.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-white sm:text-2xl">Built for</h2>
        <ul className="mt-6 flex flex-wrap gap-3">
          {venueTypes.map((venueType) => (
            <li
              key={venueType}
              className="rounded-full border border-slate-700 bg-slate-900/40 px-3 py-1.5 text-sm text-slate-200"
            >
              {venueType}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-lg border border-slate-800 bg-slate-900/30 p-6">
        <h2 className="text-xl font-semibold text-white sm:text-2xl">Free 60-Day Pilot</h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-300 sm:text-base">
          Evaluate Rapid Cortex Venue in a guided 60-day pilot. Includes QR reporting, SMS reporting, venue
          dashboard, up to 10 zones, up to 10 users, analytics, training, and onboarding support.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/contact-sales?interest=venue-demo"
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Request a demo
          </Link>
          <Link
            href="/contact"
            className="inline-flex min-h-12 items-center justify-center rounded-md border border-slate-600/90 bg-slate-950/40 px-6 py-3 text-sm font-semibold text-slate-100 hover:border-slate-500"
          >
            Contact us
          </Link>
        </div>
      </section>
    </div>
  );
}
