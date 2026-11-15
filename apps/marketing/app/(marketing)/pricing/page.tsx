import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { absoluteUrl, buildOgShareImage } from "@/lib/seo";
import { PricingQuoteForm } from "./pricing-quote-form";
import { PricingFaq } from "./pricing-faq";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Pricing | NexCort iQ",
    description:
      "Quote-based pricing tiers for 911 Centers/PSAPs, Campus, Venue, and Transit deployments. 60-day free pilot available. Grant-compatible. CJIS-aware architecture.",
    keywords: [
      "public safety pricing",
      "dispatch software pricing",
      "quote based pricing",
      "PSAP software cost",
      "campus safety pricing",
      "venue security pricing",
      "transit operations pricing",
      "911 center software pricing",
    ],
    openGraph: {
      title: "Pricing | NexCort iQ",
      description: "All plans are quote-based and tailored to your agency.",
      url: absoluteUrl("/pricing"),
      siteName: "NexCort iQ",
      images: [buildOgShareImage("NexCort iQ pricing")],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Pricing | NexCort iQ",
      description: "Quote-based plan tiers, add-on catalog, and 60-day free pilot.",
      images: [{ url: buildOgShareImage().url, alt: buildOgShareImage().alt }],
    },
    alternates: { canonical: absoluteUrl("/pricing") },
  };
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const TIERS = [
  {
    id: "starter",
    tier: "Tier 1",
    name: "Starter",
    sub: "Up to 10 dispatch positions · Single PSAP",
    price: "Quote-based · small agency",
    sla: "99.5% uptime SLA",
    badge: null,
    ctaPrimary: { label: "Request Demo", href: "#estimator" },
    ctaSecondary: { label: "Get a Quote", href: "#estimator" },
    features: [
      "Call Assist AI — voice + live transcription",
      "Incident Timeline & Activity Log",
      "Supervisor Monitoring Dashboard",
      "Standard Reporting & CSV Export",
      "Caller Media Intake",
      "Agency onboarding support",
    ],
    additive: false,
  },
  {
    id: "professional",
    tier: "Tier 2",
    name: "Professional",
    sub: "Up to 30 dispatch positions · Single or dual PSAP",
    price: "Quote-based · mid-size agency",
    sla: "99.9% uptime SLA",
    badge: null,
    ctaPrimary: { label: "Request Demo", href: "#estimator" },
    ctaSecondary: { label: "Get a Quote", href: "#estimator" },
    features: [
      "Everything in Starter, plus:",
      "Enhanced Speaker-Aware Transcription",
      "QA Scoring & Dispatcher Coaching",
      "CAD Read Integration",
      "Advanced Analytics Suite",
      "Priority support — 12hr response",
    ],
    additive: true,
  },
  {
    id: "command",
    tier: "Tier 3",
    name: "Command",
    sub: "Up to 100 positions · Multi-division, multi-shift",
    price: "Quote-based · large agency",
    sla: "99.95% uptime SLA",
    badge: "Most Popular",
    ctaPrimary: { label: "Request Demo", href: "#estimator" },
    ctaSecondary: { label: "Get a Quote", href: "#estimator" },
    features: [
      "Everything in Professional, plus:",
      "Full CAD Read + Write Integration",
      "Incident Command Center",
      "Nexiq Intelligence Dashboard",
      "Pre-Arrival iQ (configurable)",
      "Dedicated Success Manager",
      "4hr priority support",
    ],
    additive: true,
  },
  {
    id: "enterprise",
    tier: "Tier 4",
    name: "Enterprise / Statewide",
    sub: "Unlimited positions · Multi-agency deployments",
    price: "Quote-based · statewide / enterprise",
    sla: "99.99% uptime SLA + SLO guarantees",
    badge: null,
    ctaPrimary: { label: "Talk to Sales", href: "#estimator" },
    ctaSecondary: { label: "Contact Us", href: "#estimator" },
    features: [
      "Everything in Command, plus:",
      "Multi-Agency Admin Portal",
      "IQ Vision Scene Intelligence",
      "Full Platform API Access",
      "Custom Integration Development",
      "State contract vehicle support",
      "SLA with financial guarantees",
    ],
    additive: true,
  },
] as const;

type RowValue = "✓" | "—" | "Add-on" | string;
type TableSection = {
  label: string;
  rows: { feature: string; starter: RowValue; professional: RowValue; command: RowValue; enterprise: RowValue }[];
};

const TABLE_SECTIONS: TableSection[] = [
  {
    label: "Deployment",
    rows: [
      { feature: "Dispatch positions", starter: "Up to 10", professional: "Up to 30", command: "Up to 100", enterprise: "Unlimited" },
      { feature: "PSAP locations", starter: "1", professional: "1–2", command: "Multi", enterprise: "Multi-agency" },
      { feature: "Dedicated infrastructure", starter: "—", professional: "—", command: "Add-on", enterprise: "✓" },
    ],
  },
  {
    label: "Core Operations",
    rows: [
      { feature: "Call Assist AI — voice + transcription", starter: "✓", professional: "✓", command: "✓", enterprise: "✓" },
      { feature: "Speaker-aware transcription", starter: "—", professional: "✓", command: "✓", enterprise: "✓" },
      { feature: "Incident Timeline & Activity Log", starter: "✓", professional: "✓", command: "✓", enterprise: "✓" },
      { feature: "Caller Media Intake", starter: "✓", professional: "✓", command: "✓", enterprise: "✓" },
      { feature: "Incident Command Center", starter: "—", professional: "—", command: "✓", enterprise: "✓" },
      { feature: "Pre-Arrival iQ", starter: "Add-on", professional: "Add-on", command: "✓ Configurable", enterprise: "✓" },
    ],
  },
  {
    label: "CAD Integration",
    rows: [
      { feature: "CAD Read Integration", starter: "—", professional: "✓", command: "✓", enterprise: "✓" },
      { feature: "CAD Write-Back (with approval gate)", starter: "—", professional: "—", command: "✓", enterprise: "✓" },
      { feature: "CAD-to-CAD Interoperability", starter: "—", professional: "—", command: "Add-on", enterprise: "✓" },
      { feature: "RMS Integration", starter: "—", professional: "Add-on", command: "Add-on", enterprise: "✓" },
    ],
  },
  {
    label: "AI & Intelligence",
    rows: [
      { feature: "Nexiq Intelligence Dashboard", starter: "—", professional: "—", command: "✓", enterprise: "✓" },
      { feature: "IQ Vision Scene Intelligence", starter: "—", professional: "Add-on", command: "Add-on", enterprise: "✓" },
      { feature: "Live Translation (125+ languages)", starter: "Add-on", professional: "Add-on", command: "Add-on", enterprise: "Add-on" },
      { feature: "Predictive Dispatch Insights", starter: "—", professional: "—", command: "Add-on", enterprise: "✓" },
    ],
  },
  {
    label: "Analytics & Quality",
    rows: [
      { feature: "Standard Reporting & Export", starter: "✓", professional: "✓", command: "✓", enterprise: "✓" },
      { feature: "Advanced Analytics Suite", starter: "—", professional: "✓", command: "✓", enterprise: "✓" },
      { feature: "QA Scoring & Dispatcher Coaching", starter: "—", professional: "✓", command: "✓", enterprise: "✓" },
      { feature: "Custom Reporting & API Export", starter: "—", professional: "—", command: "✓", enterprise: "✓" },
      { feature: "CJIS Audit Logging", starter: "✓", professional: "✓", command: "✓", enterprise: "✓" },
    ],
  },
  {
    label: "Support & SLA",
    rows: [
      { feature: "Uptime SLA", starter: "99.5%", professional: "99.9%", command: "99.95%", enterprise: "99.99%" },
      { feature: "Support response time", starter: "48hr email", professional: "12hr priority", command: "4hr priority", enterprise: "1hr / 24×7" },
      { feature: "Dedicated Success Manager", starter: "—", professional: "—", command: "✓", enterprise: "✓" },
      { feature: "White-glove onboarding", starter: "—", professional: "—", command: "—", enterprise: "✓" },
      { feature: "SLA with financial guarantees", starter: "—", professional: "—", command: "—", enterprise: "✓" },
      { feature: "State contract vehicle support", starter: "—", professional: "—", command: "—", enterprise: "✓" },
    ],
  },
];

const ADDONS = [
  {
    icon: "🧠",
    category: "Intelligence & AI",
    items: [
      { name: "Advanced AI Triage", desc: "Configurable AI-assisted triage for faster dispatcher context and call prioritization" },
      { name: "Predictive Dispatch Insights", desc: "Pattern-based resource recommendations from historical incident data and demand forecasting" },
      { name: "Behavioral Pattern Analysis", desc: "Longitudinal caller and incident pattern analysis for operational intelligence reporting" },
    ],
  },
  {
    icon: "📡",
    category: "Communications",
    items: [
      { name: "Live Translation", desc: "Real-time language translation for 125+ languages during active emergency calls" },
      { name: "Pre-Arrival iQ", desc: "AI-guided pre-arrival instruction delivery for callers — configurable by call type and protocol" },
      { name: "311 AI Call Handler", desc: "Automated non-emergency call intake and routing with live handoff to dispatchers" },
    ],
  },
  {
    icon: "📷",
    category: "Field & Video",
    items: [
      { name: "IQ Vision Scene Intelligence", desc: "AI-powered scene analysis from caller video and connected agency cameras" },
      { name: "PTZ Camera Control", desc: "Remote pan-tilt-zoom control from the dispatch console for agency-owned IP cameras" },
      { name: "Radio Intelligence Monitor", desc: "AI-transcribed radio traffic with keyword alerting and channel activity logging" },
    ],
  },
  {
    icon: "🗂️",
    category: "CAD & Records",
    items: [
      { name: "CAD-to-CAD Interoperability", desc: "Cross-agency CAD incident sharing and mutual aid coordination across jurisdictions" },
      { name: "RMS Integration", desc: "Read and append workflows to Records Management Systems for incident continuity" },
      { name: "Enhanced CAD Write-Back", desc: "AI-suggested CAD field updates with supervisor approval gate — CJIS-aware architecture" },
    ],
  },
  {
    icon: "🎯",
    category: "Command & Coordination",
    items: [
      { name: "Hospital Routing & Diversion", desc: "Hospital-specific routing and diversion coordination for medical surge events" },
      { name: "Campus Safety Intelligence", desc: "Incident coordination and communications intelligence for campus and education environments" },
      { name: "Mutual Aid Coordination", desc: "Cross-jurisdiction resource tracking and unit availability sharing during major incidents" },
    ],
  },
  {
    icon: "📋",
    category: "Quality & Compliance",
    items: [
      { name: "Enhanced Transcription Archive", desc: "Higher-accuracy transcription with 7-year retention, full-text search, and legal export formats" },
      { name: "Performance Analytics Dashboard", desc: "Individual and team dispatcher performance trends, scoring history, and coaching logs" },
      { name: "Reliability Operations", desc: "Operational health monitoring, escalation workflows, and high-availability reporting for critical deployments" },
    ],
  },
] as const;

const PRICING_FACTORS = [
  { icon: "👥", title: "Dispatch positions", desc: "The number of active dispatch seats is the primary driver. Pricing scales with concurrent operational load — not total employee count." },
  { icon: "🏢", title: "Number of locations", desc: "Single PSAP, consolidated multi-site, or statewide deployments each carry different infrastructure and integration complexity." },
  { icon: "🔗", title: "CAD integration complexity", desc: "Your CAD vendor, version, and desired integration depth — read-only vs. write-back — affect setup effort and ongoing licensing." },
  { icon: "🧩", title: "Selected modules", desc: "Base plan plus specific add-on modules. Each module is independently licensed — you pay for what your agency actually needs." },
  { icon: "📅", title: "Contract term", desc: "Annual, two-year, or multi-year terms are available. Longer terms unlock lower monthly rates and are structured to align with grant cycles." },
  { icon: "🛠️", title: "Support & SLA tier", desc: "Response time guarantees, dedicated success manager access, and financial SLA obligations are configurable based on operational criticality." },
] as const;

// ---------------------------------------------------------------------------
// Sub-components (server)
// ---------------------------------------------------------------------------

function CellValue({ val, isCommand }: { val: RowValue; isCommand: boolean }) {
  if (val === "✓" || val === "✓ Configurable")
    return <Check className={`mx-auto h-4 w-4 ${isCommand ? "text-sky-400" : "text-emerald-500"}`} aria-label="Included" />;
  if (val === "—")
    return <Minus className="mx-auto h-4 w-4 text-slate-700" aria-label="Not included" />;
  if (val === "Add-on")
    return <span className="rounded px-1.5 py-0.5 text-[11px] font-medium text-amber-400 ring-1 ring-amber-700/40">Add-on</span>;
  return <span className="text-xs text-slate-400">{val}</span>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PricingPage() {
  return (
    <article>
      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 px-4 pb-16 pt-16 sm:px-6 lg:px-8">
        {/* subtle radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(56,189,248,0.07),transparent)]"
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-sky-500">Pricing</p>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl lg:text-5xl">
            Plans for every agency, from single PSAP to statewide
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-400">
            All plans are quote-based and tailored to your agency's size, CAD environment, and
            operational needs. No hidden seats, no surprise overages.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-sky-500" aria-hidden /> CJIS-aware architecture
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-sky-500" aria-hidden /> 60-day free pilot available
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-sky-500" aria-hidden /> Grant-compatible pricing
            </span>
          </div>
        </div>
      </section>

      {/* ── 2. TIER CARDS ───────────────────────────────────────────── */}
      <section className="bg-slate-950 px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {TIERS.map((t) => {
              const isCommand = t.id === "command";
              return (
                <div
                  key={t.id}
                  className={`relative flex flex-col rounded-xl border p-6 ${
                    isCommand
                      ? "border-sky-700/60 bg-sky-950/30 shadow-[0_0_30px_rgba(56,189,248,0.08)]"
                      : "border-slate-800 bg-slate-900/40"
                  }`}
                >
                  {t.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-600 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                      {t.badge}
                    </span>
                  )}
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                    {t.tier}
                  </p>
                  <h2 className="text-xl font-bold text-white">{t.name}</h2>
                  <p className="mt-1 text-xs text-slate-400">{t.sub}</p>

                  <ul className="mt-5 flex-1 space-y-2.5">
                    {t.features.map((f, i) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        {i === 0 && t.additive ? (
                          <span className="mt-0.5 text-sky-500 font-semibold leading-none">+</span>
                        ) : (
                          <Check
                            className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${isCommand ? "text-sky-400" : "text-emerald-500"}`}
                            aria-hidden
                          />
                        )}
                        <span className={i === 0 && t.additive ? "font-medium text-slate-200" : "text-slate-300"}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 space-y-2">
                    <p className="text-[11px] font-medium text-slate-500">{t.price}</p>
                    <div className="flex gap-2">
                      <Link
                        href={t.ctaPrimary.href}
                        className={`inline-flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          isCommand
                            ? "bg-sky-600 text-white hover:bg-sky-500"
                            : "bg-slate-800 text-slate-100 hover:bg-slate-700"
                        }`}
                      >
                        {t.ctaPrimary.label}
                      </Link>
                      <Link
                        href={t.ctaSecondary.href}
                        className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
                      >
                        {t.ctaSecondary.label}
                      </Link>
                    </div>
                  </div>
                  <p className="mt-3 text-center text-[11px] text-slate-500">{t.sla}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-xs text-slate-500">
            All plans include CJIS audit logging, isolated AWS tenancy, and compliant data handling.{" "}
            <Link href="#estimator" className="text-sky-500 hover:text-sky-400">
              Contact us
            </Link>{" "}
            to discuss your agency's specific requirements.
          </p>
        </div>
      </section>

      {/* ── 3. COMPARISON TABLE ─────────────────────────────────────── */}
      <section className="border-t border-slate-800/60 bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">Compare plans</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">What's included at each tier</h2>
            <p className="mt-2 text-sm text-slate-400">
              Full feature breakdown. Add-ons available separately for every tier.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60">
                  <th className="sticky left-0 bg-slate-900 px-5 py-3 text-left text-xs font-semibold text-slate-400">
                    Feature
                  </th>
                  {(["Starter", "Professional", "Command", "Enterprise"] as const).map((name) => (
                    <th
                      key={name}
                      className={`px-4 py-3 text-center text-xs font-semibold ${
                        name === "Command"
                          ? "text-sky-400"
                          : "text-slate-400"
                      }`}
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TABLE_SECTIONS.map((section) => (
                  <>
                    <tr key={`section-${section.label}`} className="border-t border-slate-800/60 bg-slate-900/30">
                      <td
                        colSpan={5}
                        className="sticky left-0 bg-slate-900/30 px-5 py-2 text-[11px] font-bold uppercase tracking-widest text-slate-500"
                      >
                        {section.label}
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr
                        key={row.feature}
                        className="border-t border-slate-800/30 transition-colors hover:bg-slate-900/30"
                      >
                        <td className="sticky left-0 bg-slate-950 px-5 py-3 text-left text-slate-300">
                          {row.feature}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CellValue val={row.starter} isCommand={false} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CellValue val={row.professional} isCommand={false} />
                        </td>
                        <td className="bg-sky-950/10 px-4 py-3 text-center">
                          <CellValue val={row.command} isCommand={true} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <CellValue val={row.enterprise} isCommand={false} />
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── 4. QUOTE ESTIMATOR FORM ─────────────────────────────────── */}
      <section
        id="estimator"
        className="border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-slate-900 px-4 py-16 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">
              Pricing estimate
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Estimate Your Agency's Pricing
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-slate-400">
              Answer a few questions and we'll prepare a tailored quote. No instant dollar figures
              — your quote is reviewed by our team and sent within one business day.
            </p>
          </div>
          <PricingQuoteForm />
        </div>
      </section>

      {/* ── 5. ADD-ONS ──────────────────────────────────────────────── */}
      <section className="border-t border-slate-800/60 bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">Add-ons</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Modular capabilities for every tier
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Each add-on is independently licensed and can be activated during or after onboarding
              — no plan upgrade required.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ADDONS.map((group) => (
              <div
                key={group.category}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-xl" aria-hidden>
                    {group.icon}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200">{group.category}</h3>
                </div>
                <ul className="space-y-3.5">
                  {group.items.map((item) => (
                    <li key={item.name}>
                      <p className="text-sm font-medium text-slate-100">{item.name}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. PRICING FACTORS ──────────────────────────────────────── */}
      <section className="border-t border-slate-800/60 bg-gradient-to-b from-slate-900 to-slate-950 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">
              Pricing factors
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">What shapes your quote</h2>
            <p className="mt-2 text-sm text-slate-400">
              NexCortiQ pricing is built around your operational reality, not generic seat counts.
              These are the primary factors our team evaluates.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PRICING_FACTORS.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-slate-800 bg-slate-900/40 p-5"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="text-xl" aria-hidden>
                    {f.icon}
                  </span>
                  <h3 className="text-sm font-semibold text-slate-200">{f.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-slate-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. FAQ ──────────────────────────────────────────────────── */}
      <section className="border-t border-slate-800/60 bg-slate-950 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-500">
              Procurement
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Common questions from procurement teams
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              For budget officers, grant administrators, and agency administrators navigating
              acquisition.
            </p>
          </div>
          <PricingFaq />
        </div>
      </section>

      {/* ── 8. 60-DAY PILOT CTA ─────────────────────────────────────── */}
      <section className="border-t border-slate-800/60 bg-gradient-to-br from-slate-900 to-sky-950/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-sky-500">
              Free pilot program
            </p>
            <h2 className="text-3xl font-bold text-white">
              60 days. Full access. Zero obligation.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-400">
              Qualifying agencies receive full platform access for 60 days at no cost. We handle
              the onboarding, provide a dedicated success manager, and work around your operational
              schedule.
            </p>
          </div>

          <ul className="mx-auto mb-10 grid max-w-2xl gap-y-3 sm:grid-cols-2">
            {[
              "Full platform access at your tier",
              "Hands-on onboarding support",
              "Dedicated success manager",
              "Weekly operational check-ins",
              "Complete data export if you exit",
              "No credit card required",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                <Check className="h-4 w-4 flex-shrink-0 text-sky-500" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="#estimator"
              className="inline-flex h-12 items-center rounded-lg bg-sky-600 px-8 font-semibold text-white transition-colors hover:bg-sky-500"
            >
              Start Your 60-Day Pilot →
            </Link>
            <Link
              href="#estimator"
              className="inline-flex h-12 items-center rounded-lg border border-slate-700 px-8 font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </article>
  );
}
