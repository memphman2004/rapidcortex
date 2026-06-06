import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, buildOrganizationJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "RC Core | Rapid Cortex",
    description:
      "Rapid Cortex Core provides AI-assisted situational awareness and incident intelligence for 911, EMS, fire rescue, and law enforcement operations.",
    keywords: [
      "911 software",
      "dispatch intelligence",
      "EMS dispatch software",
      "fire rescue command",
      "law enforcement incident management",
    ],
    openGraph: {
      title: "RC Core | Rapid Cortex",
      description: "Intelligence at the speed of response for core public safety operations.",
      url: absoluteUrl("/product/core"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Rapid Cortex Core" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "RC Core | Rapid Cortex",
      description: "AI-assisted public safety intelligence for dispatch operations.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/product/core") },
  };
}

export default function ProductCorePage() {
  const organizationJsonLd = buildOrganizationJsonLd();
  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-400">RC Core</p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Intelligence at the Speed of Response</h1>
        <p className="max-w-3xl text-sm text-slate-300">
          Built for 911 PSAP, EMS, fire rescue, and law enforcement teams that need coordinated decision-support under
          high-pressure incident conditions.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-medium text-white">Core capabilities</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Live call intelligence</li>
          <li>AI triage support</li>
          <li>Transcription and translation</li>
          <li>Caller media intake</li>
          <li>CAD integration</li>
          <li>Supervisor QA workflows</li>
          <li>Incident command coordination</li>
        </ul>
      </section>

      <section id="transcription" className="mt-8">
        <h2 className="text-xl font-medium text-white">Transcription support</h2>
        <p className="mt-2 text-sm text-slate-300">
          RC Core provides live transcription workflows that help dispatch and supervisory teams retain critical context
          during active incidents.
        </p>
      </section>

      <section id="supervisor" className="mt-8">
        <h2 className="text-xl font-medium text-white">Supervisor visibility</h2>
        <p className="mt-2 text-sm text-slate-300">
          Supervisor-focused dashboards provide incident and queue awareness without replacing human command oversight.
        </p>
      </section>

      <section className="mt-8 rounded-lg border border-slate-800 bg-slate-900/30 p-4">
        <h2 className="text-lg font-medium text-white">Decision-support disclaimer</h2>
        <p className="mt-2 text-sm text-slate-300">
          Rapid Cortex is a decision-support tool. It does not replace dispatcher judgment, CAD systems, medical
          direction, or established protocols.
        </p>
      </section>

      <section className="mt-8">
        <Link
          href="/request-demo"
          className="inline-flex min-h-11 items-center rounded-md bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Request a Demo
        </Link>
      </section>
    </article>
  );
}

