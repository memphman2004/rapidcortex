import type { ReactNode } from "react";
import { resolveUpstreamApiBase } from "@/lib/comms-api-path";
import {
  decodeSelfServiceToken,
  isSelfServiceTokenShape,
  selfServiceStatusLabel,
  type SelfServiceReportDto,
} from "@/lib/call-assist/self-service-report";
import { SelfServiceCompleteForm } from "./self-service-complete-form";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ token: string }> };

async function loadSelfService(token: string): Promise<{ ok: true; data: SelfServiceReportDto } | { ok: false; message: string }> {
  const upstreamPath = `/api/public/call-assist/self-service/${encodeURIComponent(token)}`;
  const base = resolveUpstreamApiBase(upstreamPath);
  if (!base) {
    return { ok: false, message: "Online reporting is temporarily unavailable. Call the non-emergency line if you still need to file a report." };
  }
  try {
    const res = await fetch(`${base}${upstreamPath}`, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as SelfServiceReportDto;
    if (!res.ok) {
      return { ok: false, message: data.error ?? "This reporting link is invalid or has expired." };
    }
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      message: "Online reporting is temporarily unavailable. Call the non-emergency line if you still need to file a report.",
    };
  }
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto max-w-lg space-y-4 p-6 text-slate-100">
      <h1 className="text-lg font-semibold">Online report</h1>
      <p className="text-sm text-slate-400">
        This is not for emergencies. If someone is hurt or in danger, hang up and dial 911.
      </p>
      {children}
    </main>
  );
}

export default async function CallAssistSelfServiceReportPage({ params }: PageProps) {
  const token = decodeSelfServiceToken((await params).token);
  if (!isSelfServiceTokenShape(token)) {
    return (
      <Shell>
        <p className="text-sm text-slate-300">
          This page needs the full secure link from your text message. Open the message and tap the complete link — do
          not type the address by hand.
        </p>
      </Shell>
    );
  }

  const loaded = await loadSelfService(token);
  if (!loaded.ok) {
    return (
      <Shell>
        <p className="text-sm text-rose-300">{loaded.message}</p>
      </Shell>
    );
  }

  const portalUrl = loaded.data.portalUrl?.trim() ?? "";
  return (
    <Shell>
      <p className="text-sm text-slate-300">
        Status: {selfServiceStatusLabel(loaded.data.status)}
        {loaded.data.caseNumber ? ` · Reference ${loaded.data.caseNumber}` : ""}
      </p>
      {portalUrl ? (
        <a
          className="inline-flex rounded bg-sky-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-600"
          href={portalUrl}
          rel="noopener noreferrer"
        >
          Continue on the agency reporting site
        </a>
      ) : (
        <p className="text-sm text-slate-400">
          This agency has not published an online reporting address. Call the non-emergency line to finish your report.
        </p>
      )}
      <SelfServiceCompleteForm token={token} initialStatus={loaded.data.status} />
    </Shell>
  );
}
