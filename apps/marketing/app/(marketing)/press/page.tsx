import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Briefcase,
  LayoutDashboard,
  Link2,
  Map,
  MapPin,
  Mic,
  Newspaper,
  Sparkles,
  Truck,
} from "lucide-react";
import {
  PressBoilerplateCopy,
  PressMediaAssetCard,
  type PressAssetItem,
} from "@/components/marketing/press/press-widgets";
import { marketingContactPath, marketingPressPath } from "@/lib/marketing-links";
import { buildPublicPageMetadata } from "@/lib/seo";

const PRESS_PATH = marketingPressPath();
const PRESS_EMAIL = "press@rapidcortex.us";
const SUPPORT_EMAIL = "support@rapidcortex.us";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Press & Media | Rapid Cortex Public Safety Intelligence Platform",
  description:
    "Press resources, media assets, and company background for journalists covering emergency communications, public safety intelligence, and 911 dispatch decision support.",
  path: PRESS_PATH,
});

const mediaAssets: PressAssetItem[] = [
  {
    id: "logo-light",
    title: "Rapid Cortex Logo (Light)",
    formats: "PNG, SVG — white / light backgrounds",
    href: "/press/assets/rapid-cortex-logo-light.png",
    secondaryLabel: "SVG",
  },
  {
    id: "logo-dark",
    title: "Rapid Cortex Logo (Dark)",
    formats: "PNG, SVG — dark backgrounds",
    href: "/press/assets/rapid-cortex-logo-dark.png",
    secondaryLabel: "SVG",
  },
  {
    id: "shot-dispatcher",
    title: "Platform Screenshot — Dispatcher Dashboard",
    formats: "2560×1600 PNG",
  },
  {
    id: "shot-supervisor",
    title: "Platform Screenshot — Supervisor Dashboard",
    formats: "2560×1600 PNG",
  },
  {
    id: "shot-admin",
    title: "Platform Screenshot — RC Admin Dashboard",
    formats: "2560×1600 PNG",
  },
  {
    id: "brand",
    title: "Brand Guidelines",
    formats: "Colors, typography, usage rules · PDF",
    downloadLabel: "Download PDF",
  },
];

const productFeatures = [
  {
    title: "Live Transcription",
    body: "Real-time caller transcription during active 911 calls. Supports English and multilingual scenarios.",
    Icon: Mic,
  },
  {
    title: "AI Incident Intelligence",
    body: "AI-generated incident summaries, priority scoring, and decision support for dispatchers.",
    Icon: Sparkles,
  },
  {
    title: "CAD Integration",
    body: "Connects to Motorola PremierOne, Tyler New World, CentralSquare, Hexagon, and generic CAD systems via secure webhook integration.",
    Icon: Link2,
  },
  {
    title: "Supervisor Command View",
    body: "Real-time oversight for shift supervisors with team performance metrics and incident monitoring.",
    Icon: LayoutDashboard,
  },
  {
    title: "LiveLocation Intelligence",
    body: "LiveLocation helps dispatchers view caller-shared location, accuracy radius, movement history, and location confidence in real time through a secure caller link.",
    Icon: MapPin,
  },
  {
    title: "Surge View Analytics",
    body: "Surge View helps dispatchers and supervisors identify related 911 calls during storms, crashes, shootings, large events, and mass-caller incidents by grouping similar calls by location, time, call type, and caller-reported details.",
    Icon: Activity,
  },
  {
    title: "Live Command Maps",
    body: "Command-center dark-theme Mapbox views for situational overlays—caller-shared pins live alongside unit markers where your CAD or AVL integration exposes positions.",
    Icon: Map,
  },
  {
    title: "Multi-vendor CAD connectivity",
    body: "Adapter paths for vendors including Motorola PremierOne, Tyler New World, CentralSquare, Hexagon Intergraph, plus generic integrations—timing and modality depend on your CAD contract.",
    Icon: Link2,
  },
  {
    title: "Unit visualization (CAD / AVL–dependent)",
    body: "Map markers and trails for apparatus and units where your CAD or AVL feed supplies positions; availability follows your vendor integration scope.",
    Icon: Truck,
  },
] as const;

const statCards = [
  { label: "Platform uptime", value: "99.97%" },
  { label: "AI summary generation", value: "Under 2 seconds" },
  { label: "Supported CAD vendors", value: "5+ major systems" },
  { label: "Desktop platforms", value: "Mac and Windows" },
  { label: "User roles supported", value: "8 specialized roles" },
  { label: "Security standard", value: "CJIS-Aligned" },
] as const;

export default function MarketingPressPage() {
  const contactPath = marketingContactPath();

  return (
    <div className="text-slate-200">
      <section className="border-b border-slate-800/80 bg-gradient-to-b from-[#050a18] via-slate-950 to-slate-950 px-4 py-14 sm:px-6 sm:py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400/90">Press &amp; media</p>
          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            Rapid Cortex in the News
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
            Resources for journalists, analysts, and media covering public safety technology and AI innovation.
          </p>
          <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
            <a
              href="/press/press-kit.zip"
              download
              className="inline-flex min-h-[48px] w-full max-w-xs items-center justify-center rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-900/25 hover:bg-sky-500 sm:w-auto"
            >
              Download Press Kit
            </a>
            <a
              href={`mailto:${PRESS_EMAIL}`}
              className="inline-flex min-h-[48px] w-full max-w-xs items-center justify-center rounded-lg border border-slate-500/90 bg-slate-950/50 px-6 py-3 text-sm font-semibold text-slate-100 backdrop-blur-sm hover:border-slate-400 sm:w-auto"
            >
              Contact Press Team
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-xl font-semibold text-white sm:text-2xl">About Rapid Cortex</h2>
        <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="space-y-5 text-sm leading-relaxed text-slate-300 sm:text-base">
            <p>
              Rapid Cortex is a Real-Time AI Intelligence platform built for public safety agencies. We help 911
              dispatchers, supervisors, and emergency response teams make faster, clearer decisions during active
              incidents — without replacing the systems they already trust.
            </p>
            <p>
              Our platform connects to existing Computer-Aided Dispatch (CAD) systems and provides live transcription,
              AI-generated incident summaries, multilingual caller support, and supervisor oversight tools — all
              designed to the security standards required for law enforcement and public safety.
            </p>
            <p>
              Rapid Cortex is CJIS-aligned, built on AWS enterprise infrastructure, and designed from the ground up for
              the unique demands of emergency communications centers.
            </p>
          </div>
          <aside className="rounded-xl border border-sky-500/35 bg-slate-950/60 p-6 shadow-[0_0_40px_-20px_rgba(56,189,248,0.35)] sm:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-300/95">Company snapshot</h3>
            <dl className="mt-6 space-y-4 text-sm">
              {(
                [
                  ["Founded", "2024"],
                  ["Headquarters", "United States"],
                  ["Industry", "Public Safety Technology / AI"],
                  ["Platform", "SaaS — Web, Desktop, API"],
                  ["Security", "CJIS-Aligned, SOC2 in progress"],
                  ["Website", "rapidcortex.us"],
                  ["Press contact", PRESS_EMAIL],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5 border-b border-slate-800/80 pb-4 last:border-0 last:pb-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{k}</dt>
                  <dd className="font-medium text-slate-100">{v}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>

      <section className="border-y border-slate-800/60 bg-slate-950/70 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">Key Facts for Media</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statCards.map((card) => (
              <li
                key={card.label}
                className="rounded-xl border border-slate-800 bg-[#0f172a]/80 px-5 py-5 shadow-inner"
              >
                <p className="text-lg font-semibold text-white sm:text-xl">{card.value}</p>
                <p className="mt-2 text-sm text-slate-400">{card.label}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-xs text-slate-500">Metrics based on internal platform testing</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-xl font-semibold text-white sm:text-2xl">The Platform</h2>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {productFeatures.map(({ title, body, Icon }) => (
            <li
              key={title}
              className="flex gap-4 rounded-xl border border-slate-800/90 bg-slate-900/35 p-5 sm:p-6"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-base font-semibold text-sky-100">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-slate-800/60 bg-slate-950 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">Press Releases</h2>
          <div className="mt-8 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 px-6 py-14 text-center">
            <p className="text-sm font-medium text-slate-300">No press releases published yet.</p>
            <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
              When announcements go live, you&apos;ll find date, headline, and read-more links here.
            </p>
          </div>
          <div className="mt-6 rounded-xl border border-slate-700/80 bg-gradient-to-br from-slate-900/80 to-slate-950 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-400/90">Coming soon</p>
              <p className="mt-2 text-base font-semibold text-white">Rapid Cortex Platform Launch</p>
              <p className="mt-1 text-sm text-slate-400">Official launch materials and executive quotes.</p>
            </div>
            <button
              type="button"
              disabled
              className="mt-4 inline-flex min-h-[44px] cursor-not-allowed items-center justify-center rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-2.5 text-sm font-semibold text-slate-500 sm:mt-0"
            >
              Read more
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-xl font-semibold text-white sm:text-2xl">Media Assets</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
          High-resolution logos, screenshots, and brand assets for editorial use.
        </p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mediaAssets.map((item) => (
            <li key={item.id}>
              <PressMediaAssetCard item={item} />
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-slate-800/60 bg-[#050a14]/90 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-semibold text-white sm:text-2xl">Approved Boilerplate</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
            Use the following description when referencing Rapid Cortex in articles, reports, and publications.
          </p>
          <div className="mt-8">
            <PressBoilerplateCopy />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">Media Inquiries</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-300">
              <Newspaper className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-5 text-lg font-semibold text-white">Press &amp; Media</h3>
            <a href={`mailto:${PRESS_EMAIL}`} className="mt-2 text-sm font-medium text-sky-400 hover:text-sky-300">
              {PRESS_EMAIL}
            </a>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-400">
              For interview requests, product briefings, and editorial inquiries.
            </p>
            <p className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
              Response time: within 1 business day
            </p>
          </div>
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-600 bg-slate-800/60 text-slate-200">
              <Briefcase className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-5 text-lg font-semibold text-white">Analyst &amp; Partnership Inquiries</h3>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-2 text-sm font-medium text-sky-400 hover:text-sky-300">
              {SUPPORT_EMAIL}
            </a>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-400">
              For industry analysts, research firms, and strategic partnership discussions.
            </p>
            <p className="mt-6 text-xs font-medium uppercase tracking-wide text-slate-500">
              Response time: within 2 business days
            </p>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-slate-500">
          <Link href="/" className="text-sky-400/90 hover:text-sky-300">
            Home
          </Link>
          <span className="mx-2 text-slate-600">·</span>
          <Link href={contactPath} className="text-sky-400/90 hover:text-sky-300">
            Contact
          </Link>
        </p>
      </section>
    </div>
  );
}
