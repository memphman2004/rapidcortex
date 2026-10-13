"use client";

import Link from "next/link";
import { DocumentLibraryOpenHelp } from "@/components/help/document-library-open-help";
import { FeatureArchitectureMaps } from "@/components/help/feature-architecture-maps";
import {
  FEATURE_ARCHITECTURE_FLOWS,
  type FlowId,
} from "@/lib/feature-architecture/flows";
import { getHelpIndex } from "@/lib/help/help-content";
import {
  canBrowseAllDocumentLibraries,
  documentLibraryVerticalsForRole,
  primaryDocumentLibraryVerticalForRole,
} from "@/lib/help/document-library-access";
import {
  type DocumentLibraryVertical,
} from "@/lib/help/document-library-verticals";
import {
  marketingCompleteManualPath,
  qrNfcSetupGuidePath,
} from "@/lib/marketing-links";
import { navIconByName } from "@/lib/navigation/nav-icons";

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

function firstFlowId(flowIds: FlowId[] | "all"): FlowId | undefined {
  if (flowIds === "all") return FEATURE_ARCHITECTURE_FLOWS[0]?.id;
  return flowIds[0] ?? FEATURE_ARCHITECTURE_FLOWS[0]?.id;
}

function hubCardHref(vertical: DocumentLibraryVertical): string {
  // Platform hub stays under /rc-admin; sales contractors use /sales/document-library.
  if (vertical.id === "sales") return "/rc-admin/document-library/sales";
  return vertical.href;
}

function VerticalHubCards({ verticals }: { verticals: DocumentLibraryVertical[] }) {
  if (verticals.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        Product vertical libraries
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {verticals.map((vertical) => {
          const Icon = navIconByName(vertical.icon);
          return (
            <Link
              key={vertical.id}
              href={hubCardHref(vertical)}
              prefetch={false}
              className="rounded-xl border border-slate-800 bg-slate-900/35 p-4 transition hover:border-slate-600 hover:bg-slate-900/55"
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-violet-300" aria-hidden />
                <div className="text-sm font-semibold text-white">{vertical.label}</div>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{vertical.description}</p>
              <span className="mt-3 inline-block text-xs text-sky-400">Open library →</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function VerticalHelpTopics({ vertical }: { vertical: DocumentLibraryVertical }) {
  const index = getHelpIndex(vertical.helpRole);
  const articles = index.flatMap((section) =>
    section.articles.map((article) => ({
      ...article,
      section: section.section,
    })),
  );

  if (articles.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {vertical.shortLabel} help topics
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {articles.map((article) => (
          <div
            key={`${article.section}-${article.topic}`}
            className="rounded-xl border border-slate-800 bg-slate-900/35 p-4"
          >
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {article.section}
            </div>
            <div className="mt-1 text-sm font-semibold text-white">{article.title}</div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{article.description}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Open the in-app Help panel for full articles. Topics mirror the {vertical.shortLabel} operator
        experience.
      </p>
    </section>
  );
}

/**
 * Document library hub / vertical view.
 * Multi-vertical hub cards are platform roles only; other roles auto-scope to their vertical.
 */
export function DocumentLibraryClient({
  title = "Document Library",
  subtitle = "Interactive architecture maps and curated platform documentation for admins and IT.",
  vertical,
  role,
  hubHref = "/rc-admin/document-library",
}: {
  title?: string;
  subtitle?: string;
  vertical?: DocumentLibraryVertical;
  /** Session role — required to hide other verticals from non-platform users. */
  role?: string;
  /** Breadcrumb link back to the hub (platform only). */
  hubHref?: string;
}) {
  const allowedVerticals = documentLibraryVerticalsForRole(role);
  const browseAll = canBrowseAllDocumentLibraries(role);
  const scopedVertical =
    vertical ??
    (browseAll ? undefined : primaryDocumentLibraryVerticalForRole(role));

  // Platform hub: all cards. Non-platform: never show cross-vertical cards (avoids /rc-admin bounce).
  const showHub = browseAll && !scopedVertical;
  const hubVerticals = showHub ? allowedVerticals : [];

  const flowIds = scopedVertical?.flowIds;
  const showMaps =
    !scopedVertical || flowIds === "all" || (Array.isArray(flowIds) && flowIds.length > 0);
  const initialFlowId = scopedVertical
    ? firstFlowId(scopedVertical.flowIds ?? "all")
    : "ca_confirm";

  return (
    <div className="space-y-8 p-4 md:p-6">
      <header>
        {scopedVertical && browseAll ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-violet-300/90">
            <Link href={hubHref} className="hover:text-violet-200">
              Document Library
            </Link>
            <span className="mx-1.5 text-slate-600">/</span>
            {scopedVertical.shortLabel}
          </p>
        ) : null}
        <h1 className="text-lg font-semibold text-white">
          {scopedVertical && !browseAll
            ? `${scopedVertical.label} Document Library`
            : title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          {scopedVertical && !browseAll ? scopedVertical.description : subtitle}
        </p>
      </header>

      {showHub ? <VerticalHubCards verticals={hubVerticals} /> : null}

      {scopedVertical ? <VerticalHelpTopics vertical={scopedVertical} /> : null}

      {showMaps ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Interactive architecture
            {scopedVertical ? ` · ${scopedVertical.shortLabel}` : ""}
          </h2>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4 md:p-5">
            <FeatureArchitectureMaps
              flowIds={flowIds === "all" || !flowIds ? undefined : flowIds}
              initialFlowId={initialFlowId}
            />
          </div>
        </section>
      ) : null}

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
