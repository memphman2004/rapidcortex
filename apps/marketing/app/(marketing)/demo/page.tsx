import type { Metadata } from "next";
import { DemoRequestForm } from "@/components/marketing/demo/demo-request-form";
import { DemoVideoGallery } from "@/components/marketing/demo/demo-video-gallery";
import { MarketingBookAppointmentLink } from "@/components/marketing/marketing-book-appointment-link";
import { marketingDemoPath } from "@/lib/marketing-links";
import { absoluteUrl, buildPublicPageMetadata } from "@/lib/seo";

const DEMO_PATH = marketingDemoPath();
const DEMO_CANONICAL = "https://www.rapidcortex.us/demo";

export const metadata: Metadata = {
  ...buildPublicPageMetadata({
    title: "Watch the Demo | Rapid Cortex Public Safety Intelligence Platform",
    description:
      "Watch how Rapid Cortex supports 911 dispatch intelligence with live transcription, multilingual workflows, caller media intake, supervisor visibility, continuity logs, and CAD-friendly decision support.",
    path: DEMO_PATH,
  }),
  alternates: {
    canonical: DEMO_CANONICAL,
  },
};

const seeItems = [
  {
    title: "Live Transcription",
    body: "AI transcribes the caller in real time so dispatchers can read, scan, and act without losing audio context.",
  },
  {
    title: "Incident Intelligence",
    body: "AI summarizes and prioritizes key facts so supervisors and teams share a fast, consistent picture of the incident.",
  },
  {
    title: "CAD Integration",
    body: "Connects directly to your existing CAD system — intelligence in the loop without replacing your records of truth.",
  },
  {
    title: "LiveLocation",
    body: "LiveLocation helps dispatchers view caller-shared location, accuracy radius, movement history, and location confidence in real time through a secure caller link.",
  },
  {
    title: "Surge View",
    body: "Surge View helps dispatchers and supervisors identify related 911 calls during storms, crashes, shootings, large events, and mass-caller incidents by grouping similar calls by location, time, call type, and caller-reported details.",
  },
  {
    title: "Operational maps",
    body: "Dark-theme Mapbox views for caller pins and command surfaces—aligned with the same mapping stack used across the platform.",
  },
] as const;

const roles = [
  "Dispatchers",
  "Supervisors",
  "Agency Admins",
  "IT Administrators",
  "Public Safety Directors",
] as const;

export default function MarketingDemoPage() {
  const shareUrl = absoluteUrl(DEMO_PATH);

  return (
    <div className="text-slate-200">
      <section className="border-b border-slate-800/80 bg-gradient-to-b from-[#050a18] via-slate-950 to-slate-950 px-4 py-14 sm:px-6 sm:py-16 md:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400/90">Live platform demo</p>
          <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
            See Rapid Cortex in action
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg">
            Watch how dispatchers and supervisors use real-time AI intelligence during active emergency incidents.
          </p>
        </div>
      </section>

      <section className="border-b border-slate-800/60 bg-slate-950 px-4 py-12 sm:px-6 sm:py-16">
        <DemoVideoGallery shareUrl={shareUrl} />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">What you&apos;ll see</h2>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {seeItems.map((item) => (
            <li
              key={item.title}
              className="rounded-xl border border-slate-800/90 bg-slate-900/35 p-6 shadow-sm shadow-black/20"
            >
              <h3 className="text-base font-semibold text-sky-200">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-slate-800/60 bg-slate-950/80 px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-xl font-semibold text-white sm:text-2xl">
            Built for the moments when every second matters
          </h2>
          <ul className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            {[
              { stat: "< 2 sec", label: "AI summary generation time" },
              { stat: "99.97%", label: "Platform uptime" },
              { stat: "CJIS-aligned", label: "Security standard" },
            ].map((card) => (
              <li
                key={card.stat}
                className="rounded-xl border border-slate-800 bg-slate-900/40 px-5 py-6 text-center shadow-inner"
              >
                <p className="text-2xl font-bold tracking-tight text-white md:text-3xl">{card.stat}</p>
                <p className="mt-2 text-sm text-slate-400">{card.label}</p>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-xs text-slate-500">Performance metrics from internal testing.</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          <div>
            <h2 className="text-lg font-semibold text-white sm:text-xl">Who is this for</h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-slate-300">
              {roles.map((r) => (
                <li key={r} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500/90" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800/90 bg-slate-900/30 p-6 sm:p-8">
            <p className="text-sm leading-relaxed text-slate-300 sm:text-base">
              Rapid Cortex works alongside your existing CAD system. No replacement. No disruption. Pure intelligence
              overlay.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-800/60 bg-gradient-to-b from-slate-950 to-[#050a18] px-4 py-14 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Ready to see it at your agency?</h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
            Request a live demo with your team — we&apos;ll walk through a scenario relevant to your agency type.
          </p>
          <MarketingBookAppointmentLink className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-sky-600 px-8 py-3 text-sm font-semibold text-white hover:bg-sky-500">
            Book appointment
          </MarketingBookAppointmentLink>
        </div>
        <div className="mx-auto mt-10 max-w-2xl">
          <p className="mb-4 text-center text-sm text-slate-500">Or send a request and we&apos;ll follow up:</p>
          <DemoRequestForm />
        </div>
      </section>
    </div>
  );
}
