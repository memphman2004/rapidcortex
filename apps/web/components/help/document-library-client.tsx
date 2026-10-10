"use client";

import { DocumentLibraryOpenHelp } from "@/components/help/document-library-open-help";
import { FeatureArchitectureMaps } from "@/components/help/feature-architecture-maps";
import {
  marketingCompleteManualPath,
  qrNfcSetupGuidePath,
} from "@/lib/marketing-links";

const STATIC_DOCS = [
  {
    title: "Complete Operations Manual",
    description: "Printable single-file operations manual for agency onboarding and day-to-day use.",
    href: marketingCompleteManualPath(),
  },
  {
    title: "QR & NFC Setup Guide",
    description: "Field setup PDF for location codes across campus, venue, and transit.",
    href: qrNfcSetupGuidePath(),
  },
] as const;

/**
 * Document library for SuperAdmin, Admin, and IT roles.
 * Interactive architecture maps plus curated static references.
 */
export function DocumentLibraryClient({
  title = "Document Library",
  subtitle = "Interactive architecture maps and curated platform documentation for admins and IT.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="space-y-8 p-4 md:p-6">
      <header>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">{subtitle}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Interactive architecture
        </h2>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:p-5">
          <FeatureArchitectureMaps />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Reference documents
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {STATIC_DOCS.map((doc) => (
            <a
              key={doc.href}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-slate-800 bg-slate-900/35 p-4 transition hover:border-slate-600 hover:bg-slate-900/55"
            >
              <div className="text-sm font-semibold text-white">{doc.title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{doc.description}</p>
              <span className="mt-3 inline-block text-xs text-sky-400">Open →</span>
            </a>
          ))}
          <DocumentLibraryOpenHelp />
        </div>
      </section>
    </div>
  );
}
