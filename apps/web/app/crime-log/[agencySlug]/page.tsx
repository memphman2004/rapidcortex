import { headers } from "next/headers";
import type { Metadata } from "next";
import { buildPublicPageMetadata } from "@/lib/seo";

export const revalidate = 900;

type PublicLog = {
  institutionName: string;
  statute: string;
  windowStart: string;
  windowEnd: string;
  lastUpdated: string | null;
  archiveNote: string;
  contact: { name?: string; email?: string; phone?: string };
  entries: Array<{
    reportedDate: string;
    reportedTime?: string;
    occurredDate?: string;
    occurredTime?: string;
    occurredDateRange?: string;
    offenseCategoryDisplayName: string;
    generalLocation: string;
    disposition: string;
    isHateCrime: boolean;
  }>;
};

async function loadLog(slug: string): Promise<PublicLog | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "http";
  const url = host
    ? `${proto}://${host}/api/public/crime-log/${encodeURIComponent(slug)}`
    : `/api/public/crime-log/${encodeURIComponent(slug)}`;
  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    return (await res.json()) as PublicLog;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}): Promise<Metadata> {
  const { agencySlug } = await params;
  return buildPublicPageMetadata({
    title: `Daily Crime Log | ${agencySlug.toUpperCase()}`,
    description: "Public Daily Crime Log maintained per the Jeanne Clery Act (20 U.S.C. § 1092(f)).",
    path: `/crime-log/${agencySlug}`,
  });
}

export default async function PublicCrimeLogPage({
  params,
}: {
  params: Promise<{ agencySlug: string }>;
}) {
  const { agencySlug } = await params;
  const log = await loadLog(agencySlug);

  if (!log) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 text-slate-200">
        <h1 className="text-2xl font-semibold">Daily Crime Log</h1>
        <p className="mt-2 text-sm text-slate-400">No public crime log is available for this campus.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10 text-slate-100">
      <p className="text-xs uppercase tracking-wide text-slate-400">Jeanne Clery Act · {log.statute}</p>
      <h1 className="mt-1 text-3xl font-semibold">{log.institutionName}</h1>
      <p className="text-lg text-slate-300">Daily Crime Log</p>
      <p className="mt-2 text-sm text-slate-400">Public record — no login required. Victim-identifying information is never published.</p>
      <table className="mt-6 w-full text-left text-sm">
        <thead className="text-xs uppercase text-slate-400">
          <tr>
            <th className="py-2">Date/Time reported</th>
            <th>Occurred</th>
            <th>Location (general)</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          {log.entries.map((e, i) => (
            <tr key={`${e.reportedDate}-${i}`} className="border-t border-slate-800">
              <td className="py-2">
                {e.reportedDate}
                <div className="text-xs text-slate-500">{e.reportedTime}</div>
              </td>
              <td>
                {e.occurredDateRange || e.occurredDate || "—"}
                <div className="text-xs text-slate-500">{e.occurredTime}</div>
              </td>
              <td>{e.generalLocation}</td>
              <td>
                {e.offenseCategoryDisplayName}
                {e.isHateCrime ? " (hate crime)" : ""}
                <div className="text-xs text-slate-500">{e.disposition}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-xs text-slate-500">
        Showing 60-day window: {log.windowStart} — {log.windowEnd}. {log.archiveNote}
      </p>
      <p className="text-xs text-slate-500">
        Contact: {log.contact.name}
        {log.contact.email ? ` · ${log.contact.email}` : ""}
        {log.contact.phone ? ` · ${log.contact.phone}` : ""}
      </p>
      {log.lastUpdated ? <p className="text-xs text-slate-500">Last updated: {log.lastUpdated}</p> : null}
    </main>
  );
}
