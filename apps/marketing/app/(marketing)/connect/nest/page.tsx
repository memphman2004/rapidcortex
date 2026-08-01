import type { Metadata } from "next";
import Link from "next/link";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { absoluteUrl } from "@/lib/seo";
import { GOOGLE_NEST_TM, NEST_TM, RING_TM } from "@/lib/brand-marks";

export const metadata: Metadata = {
  title: `${GOOGLE_NEST_TM} cameras | Rapid Cortex Connect`,
  description: `${GOOGLE_NEST_TM} SDM cameras in Rapid Cortex: agency-linked streams plus nearby citizen ${NEST_TM} devices with consent-gated emergency video for dispatch, campus, and venue teams.`,
  alternates: { canonical: absoluteUrl("/connect/nest") },
};

export default function NestConnectPage() {
  return (
    <MarketingArticleShell
      eyebrow="Rapid Cortex Connect"
      title={`${GOOGLE_NEST_TM} cameras`}
      sectionLabel="Connect"
    >
      <p className="leading-relaxed text-slate-200">
        Rapid Cortex Connect supports{" "}
        <strong className="text-white">{GOOGLE_NEST_TM}</strong> alongside {RING_TM}: agency-owned
        cameras via Google SDM OAuth, and nearby citizen {NEST_TM} devices with the same
        consent-first request pattern used for {RING_TM} doorbells.
      </p>

      <section className="mt-8 space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-6 text-sm leading-relaxed text-slate-300">
        <h2 className="text-base font-semibold text-white">How it works for agencies</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-slate-100">Link the agency {NEST_TM} account.</strong> An agency
            admin completes Google SDM OAuth from Rapid Cortex Admin → Integrations (or Campus /
            Venue Cameras). Client secrets stay in AWS Secrets Manager — never in the browser.
          </li>
          <li>
            <strong className="text-slate-100">Agency cameras on Media.</strong> Dispatchers and
            campus/venue operators can view linked {NEST_TM} streams next to {RING_TM} and facility
            video during an active incident.
          </li>
          <li>
            <strong className="text-slate-100">Nearby citizen {NEST_TM} devices.</strong> When
            incident GPS is known, Rapid Cortex can list eligible nearby {NEST_TM} cameras and send a
            time-limited sharing request. The owner approves or declines — nothing is automatic.
          </li>
          <li>
            <strong className="text-slate-100">Campus dorms &amp; venues.</strong> The same Connect
            flow is available on campus and venue Cameras pages when students or facilities use{" "}
            {NEST_TM} at the door.
          </li>
        </ul>
      </section>

      <section className="mt-8 space-y-4 rounded-2xl border border-slate-700/80 bg-slate-950/40 p-6 text-sm leading-relaxed text-slate-300">
        <h2 className="text-base font-semibold text-white">Privacy &amp; consent</h2>
        <p>
          Citizen {NEST_TM} access is request-based and time-bounded. Rapid Cortex is designed for
          live operational viewing with owner approval — not silent always-on surveillance of
          residential devices.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Owners can decline or stop sharing on each request.</li>
          <li>
            Agency admins can disconnect {GOOGLE_NEST_TM} OAuth from Integrations at any time.
          </li>
          <li>
            Full policy:{" "}
            <Link href="/legal/privacy/" className="text-sky-400 hover:text-sky-300">
              Privacy policy
            </Link>{" "}
            ·{" "}
            <Link href="/legal/terms/" className="text-sky-400 hover:text-sky-300">
              Terms
            </Link>
          </li>
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link
          href="/contact-sales?interest=nest"
          className="inline-flex rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
        >
          Talk to us about {NEST_TM}
        </Link>
        <Link
          href="/connect/ring/start"
          className="inline-flex rounded-md border border-slate-600 px-4 py-2 font-medium text-slate-200 hover:border-slate-500 hover:text-white"
        >
          {RING_TM} Connect for device owners →
        </Link>
        <a
          href="/integrations"
          className="inline-flex items-center text-sky-400 hover:text-sky-300"
        >
          All integrations →
        </a>
      </div>

      <p className="mt-10 text-xs text-slate-500">
        Agency staff: sign in at{" "}
        <Link href="https://app.rapidcortex.us/login" className="text-sky-400 hover:text-sky-300">
          app.rapidcortex.us
        </Link>{" "}
        to connect {NEST_TM} under Admin → Integrations or your Campus / Venue Cameras workspace.
      </p>
    </MarketingArticleShell>
  );
}
