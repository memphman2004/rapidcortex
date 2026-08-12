import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { marketingNestConnectPath, marketingRingCustomersPath } from "@/lib/marketing-links";
import { buildPublicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Campus, Venue & Public Safety Integrations | Rapid Cortex",
  description:
    "Rapid Cortex integrations for campus safety, venue and stadium operations, CAD-friendly public safety adapters, and consent-based Ring and Nest Connect — validated per contract, not a rip-and-replace.",
  path: "/integrations",
  keywords: [
    "campus safety integrations",
    "venue safety integrations",
    "stadium camera integrations",
    "CAD integration",
    "Ring Connect public safety",
    "Nest camera integration",
  ],
});

const CAMPUS_ITEMS = [
  {
    href: "/campus-safety-integrations",
    label: "Campus safety integrations overview",
  },
  { href: "/connect/ring/start", label: "Ring Connect — consent-based emergency video" },
  { href: "/connect/nest", label: "Google Nest SDM — agency-linked + consent requests" },
  { href: "/campus-safety-software", label: "QR / NFC / SMS campus reporting" },
  { href: "/cad-integration", label: "Optional dispatch / CAD-friendly handoff" },
];

const VENUE_ITEMS = [
  {
    href: "/venue-safety-integrations",
    label: "Venue safety integrations overview",
  },
  { href: "/venue-safety-software", label: "QR / SMS guest reporting for events" },
  { href: "/stadium-security-software", label: "Stadium SOC dashboard + camera references" },
  { href: "/connect/ring/start", label: "Ring Connect for venue perimeters" },
  { href: "/connect/nest", label: "Nest Connect for facility cameras" },
];

const PUBLIC_SAFETY_ITEMS = [
  { href: "/cad-integration", label: "CAD-friendly integration (not a CAD replacement)" },
  { href: "/product/core", label: "Rapid Cortex Core for 911 / PSAP intelligence" },
  { href: "/ng911-software", label: "NG911 decision-support layer" },
  { href: "/psap-software", label: "PSAP operational awareness" },
];

export default function IntegrationsLandingPage() {
  return (
    <MarketingArticleShell
      eyebrow="Ecosystem"
      title="Integrations for campus, venue, and public safety"
      sectionLabel="Partners"
    >
      <p className="leading-relaxed text-slate-200">
        Rapid Cortex connects reporting channels, consent-based cameras, and CAD-friendly adapters to
        the consoles your teams already use. We publish ingestion contracts first, then enable
        adapters that are validated per agency or venue contract. Maturity varies by stack — we do
        not claim a universal plug-and-play marketplace.
      </p>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold text-white">Campus safety integrations</h2>
        <p className="text-sm leading-relaxed text-slate-300">
          Universities and K-12 teams use Rapid Cortex Campus to bring QR/NFC/SMS reports and
          optional camera consent flows onto one incident. These adapters enhance campus police and
          emergency-management workflows. They do not replace campus police, 911, or medical
          direction.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          {CAMPUS_ITEMS.map((item) => (
            <li key={item.href + item.label}>
              <Link href={item.href} className="text-sky-300 hover:text-sky-200">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold text-white">Venue and stadium integrations</h2>
        <p className="text-sm leading-relaxed text-slate-300">
          Stadiums, arenas, and large events use Rapid Cortex Venue so guest reports land on the SOC
          dashboard with zone and camera context. Rapid Cortex is not a 911 emergency dispatch
          system and does not replace radios or existing CCTV control rooms.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          {VENUE_ITEMS.map((item) => (
            <li key={item.href + item.label}>
              <Link href={item.href} className="text-sky-300 hover:text-sky-200">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold text-white">Public safety and CAD adapters</h2>
        <p className="text-sm leading-relaxed text-slate-300">
          Rapid Cortex Core is an intelligence layer for 911 centers and PSAPs. CAD write-back is
          off by default and only enabled when an agency has completed legal and operational
          go/no-go. Telephony, RMS, GIS, and collaboration bridges are scoped per contract.
        </p>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          {PUBLIC_SAFETY_ITEMS.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="text-sky-300 hover:text-sky-200">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold text-white">Ring and Nest Connect</h2>
        <p className="text-sm leading-relaxed text-slate-300">
          Ring™ and Google Nest™ Connect are consent-based video paths for public safety, campus,
          and venue teams. Device owners opt in; Rapid Cortex does not silently access residential
          cameras. Agency-owned Nest devices can be linked; resident devices require an explicit
          request during an incident.
        </p>
        <div className="flex flex-wrap gap-6 text-sm">
          <a href={marketingRingCustomersPath()} className="text-sky-300 hover:text-sky-200">
            Ring Connect enrollment →
          </a>
          <a href={marketingNestConnectPath()} className="text-sky-300 hover:text-sky-200">
            Nest Connect →
          </a>
          <Link href="/integrations/ring-review" className="text-sky-300 hover:text-sky-200">
            Ring review notes →
          </Link>
        </div>
      </section>

      <section className="mt-12 rounded-lg border border-slate-800/80 bg-slate-900/40 p-5">
        <h2 className="text-base font-semibold text-white">Adapter maturity</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Connector availability is contract-validated. If your CAD, camera, or notification vendor
          is not listed here, ask during a pilot scoping call — we do not ship unvalidated adapters
          as if they were generally available.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link
            href="https://www.rapidcortex.us/contact-sales?interest=demo"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Talk to integrations
          </Link>
          <Link
            href="/free-60-day-pilot"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-600 bg-slate-900/50 px-5 py-2.5 text-sm font-semibold text-slate-100 hover:border-slate-500"
          >
            Free 60-Day Pilot
          </Link>
        </div>
      </section>

      <div className="mt-14 flex flex-wrap gap-8 text-xs text-slate-400">
        <Link href="/product/campus" className="hover:text-white">
          RC Campus →
        </Link>
        <Link href="/product/venue" className="hover:text-white">
          RC Venue →
        </Link>
        <Link href="/developers" className="hover:text-white">
          Developers hub →
        </Link>
        <Link href="/trust" className="hover:text-white">
          Trust disclosures →
        </Link>
      </div>
    </MarketingArticleShell>
  );
}
