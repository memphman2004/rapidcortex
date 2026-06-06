import type { Metadata } from "next";
import Link from "next/link";
import { buildPublicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...buildPublicPageMetadata({
    title: "How Rapid Cortex Venue Works | QR & SMS Venue Safety Reporting",
    description:
      "Guests scan a QR code or text a venue code to report incidents. Rapid Cortex routes the report to security with location, media, and nearby camera references — and can escalate to 911 dispatch if needed.",
    path: "/venue/how-it-works",
  }),
  alternates: {
    canonical: "https://www.rapidcortex.us/venue/how-it-works",
  },
};

const workflowSteps = [
  "Guest scans a QR code posted at their zone or section OR texts their venue code to 723389 (SAFETY)",
  "Rapid Cortex receives the report and creates a tracked incident",
  "Venue, location, and any attached media are automatically linked",
  "Nearby camera references are attached based on zone mapping",
  "Security dashboard is notified immediately",
  "Security assigns personnel and responds",
  "If needed: escalate to Rapid Cortex Core for emergency communications coordination — no automatic 911 call, human decision always in the loop",
] as const;

export default function VenueHowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        From Guest Report to Security Response in Seconds
      </h1>

      <ol className="mt-8 list-decimal space-y-4 pl-6 text-sm leading-relaxed text-slate-300 sm:text-base">
        {workflowSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      <p className="mt-8 text-sm leading-relaxed text-slate-500">
        Rapid Cortex is not a replacement for venue security, camera systems, radios, CAD systems, or 911.
        Rapid Cortex is a force multiplier that improves operational awareness, communication, and incident
        coordination.
      </p>

      <div className="mt-8">
        <Link
          href="/contact-sales?interest=venue-demo"
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-500"
        >
          See a demo
        </Link>
      </div>
    </div>
  );
}
