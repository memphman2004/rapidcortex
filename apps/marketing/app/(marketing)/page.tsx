import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Activity, GraduationCap, LayoutGrid, Map, MapPin, Play, Shield } from "lucide-react";
import { MarketingHeroAnimated } from "@/components/marketing/hero/marketing-hero-animated";
import { MarketingSplashGate } from "@/components/marketing/marketing-splash-gate";
import { isPublicSignupUiEnabled } from "@/lib/auth/public-signup";
import {
  marketingDashboardPath,
  marketingDemoPath,
  marketingLoginPath,
  marketingPricingPath,
  marketingSignupPath,
} from "@/lib/marketing-links";
import { MarketingPilotResourcesStrip } from "@/components/marketing/pilot-resources-strip";
import { SITE_MISSION, SITE_NAME, SITE_SLOGAN } from "@/lib/site";
import { absoluteUrl, buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Home | Rapid Cortex",
    description:
      "Rapid Cortex is an intelligence layer for emergency response teams with AI-assisted situational awareness, transcription, translation, and command coordination.",
    keywords: [
      "rapid cortex",
      "911 dispatch intelligence",
      "public safety software",
      "incident command platform",
      "emergency communications intelligence",
    ],
    openGraph: {
      title: "Home | Rapid Cortex",
      description: "Intelligence at the speed of response.",
      url: absoluteUrl("/"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex home" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Home | Rapid Cortex",
      description: "Intelligence at the speed of response.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/") },
  };
}

export default function MarketingHomePage() {
  const login = marketingLoginPath();
  const app = marketingDashboardPath();
  const signup = marketingSignupPath();
  const pricing = marketingPricingPath();
  const demo = marketingDemoPath();
  const signupEnabled = isPublicSignupUiEnabled();
  const organizationJsonLd = buildOrganizationJsonLd();
  const websiteJsonLd = buildWebsiteJsonLd();
  const softwareApplicationJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Rapid Cortex",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Windows, macOS",
    url: "https://www.rapidcortex.us",
    description:
      "Unified public safety intelligence platform with three products: Rapid Cortex Core for 911 centers and PSAPs, Rapid Cortex Venue for stadium and venue safety coordination, and Rapid Cortex Connect for emergency camera and media sharing.",
    offers: [
      {
        "@type": "Offer",
        name: "Free 60-Day Pilot Program",
        description:
          "Qualified agencies and venues can evaluate Rapid Cortex with a structured 60-day pilot.",
        price: "0",
        priceCurrency: "USD",
      },
    ],
    provider: {
      "@type": "Organization",
      name: "Rapid Cortex",
      url: "https://www.rapidcortex.us",
      email: "Support@rapidcortex.us",
      founder: { "@type": "Person", name: "Dr. Jeffrey W. Coleman" },
    },
  };

  return (
    <div>
      <MarketingSplashGate />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <section className="relative overflow-hidden border-b border-slate-800/80">
        <MarketingHeroAnimated>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400/90 drop-shadow-sm">
            Public safety
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-white drop-shadow-sm sm:mt-3 sm:text-4xl md:text-5xl">
            Intelligence at the Speed of Response
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-slate-300/95 drop-shadow-sm">
            {SITE_MISSION}
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-slate-400/95 drop-shadow-sm">
            <strong className="font-medium text-slate-200">
              {SITE_NAME} does not replace CAD — it enhances CAD with AI
            </strong>{" "}
            in the loop with your team: a browser co-pilot for incidents, transcripts, translation, and
            protocol-aligned coaching — built for 24/7 comms floors.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            {signupEnabled ? (
              <Link
                href={signup}
                className="inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-sky-900/30 hover:bg-sky-500 sm:w-auto sm:text-sm"
              >
                Create account
              </Link>
            ) : null}
            <Link
              href={demo}
              className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-md border border-white/90 bg-transparent px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-white/10 sm:w-auto sm:text-sm"
            >
              <Play className="h-4 w-4 shrink-0 fill-current" aria-hidden />
              Watch Demo
            </Link>
            <Link
              href={pricing}
              className="inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-md border border-slate-600/90 bg-slate-950/40 px-6 py-3 text-base font-semibold text-slate-100 backdrop-blur-sm hover:border-slate-500 sm:w-auto sm:text-sm"
            >
              View plans
            </Link>
            <Link
              href={login}
              className="hidden shrink-0 text-sm font-medium text-slate-400 underline-offset-4 hover:text-slate-200 hover:underline md:inline"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-8 hidden text-xs text-slate-500 md:block">
            Already onboarded?{" "}
            <Link href={app} className="text-sky-400/90 hover:text-sky-300">
              Open the dispatcher workspace
            </Link>
          </p>
        </MarketingHeroAnimated>
      </section>

      <section className="relative z-10 bg-slate-950 mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">
          Built for mission-critical calm
        </h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
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
                body: "Mapbox-backed command-center maps align with Rapid Cortex workstations—carry caller-shared pins and situational context alongside CAD-driven unit markers when your feed supports them.",
                Icon: Map,
              },
              {
                title: "Live workspace",
                body: "Incident queue, transcript, and AI-assisted analysis in one dark-mode surface tuned for long shifts.",
                Icon: LayoutGrid,
              },
              {
                title: "Protocol respect",
                body: "Coaching and hints are framed as agency-aligned decision support — not autonomous dispatch.",
                Icon: Shield,
              },
              {
                title: "Training paths",
                body: "Scripted demo scenarios for academy and sales walkthroughs, separate from production traffic.",
                Icon: GraduationCap,
              },
            ] satisfies ReadonlyArray<{ title: string; body: string; Icon: LucideIcon }>
          ).map((item) => (
            <li
              key={item.title}
              className="rounded-lg border border-slate-800 bg-slate-900/30 p-6"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300">
                <item.Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-sky-200">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative z-10 bg-slate-950 mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">Explore product lines</h2>
        <nav className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Product pages">
          <Link
            href="/product/core"
            className="rounded-md border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-900/70"
          >
            RC Core
          </Link>
          <Link
            href="/product/campus"
            className="rounded-md border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-900/70"
          >
            RC Campus
          </Link>
          <Link
            href="/product/venue"
            className="rounded-md border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-900/70"
          >
            RC Venue
          </Link>
        </nav>
      </section>

      <section className="relative z-10 bg-slate-950 mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">
          Explore 911 and NG911 resources
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-sm text-slate-400">
          Rapid Cortex is an intelligence and decision-support layer that works alongside CAD and
          NG911 systems for emergency communications teams.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/ng911-software", label: "NG911 software" },
            { href: "/911-dispatch-software", label: "911 dispatch software" },
            { href: "/psap-software", label: "PSAP software" },
            { href: "/cad-integration", label: "CAD integration" },
            { href: "/911-call-transcription", label: "911 call transcription" },
            { href: "/public-safety-intelligence", label: "Public safety intelligence" },
            { href: "/supervisor-dashboard", label: "Supervisor dashboard" },
            { href: "/free-60-day-pilot", label: "Free 60-day pilot" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-900/70"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <MarketingPilotResourcesStrip />
    </div>
  );
}
