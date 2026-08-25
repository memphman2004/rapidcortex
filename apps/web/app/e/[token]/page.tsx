import type { EscalationAuditEntry, EscalationRecord } from "rapid-cortex-shared";
import { EscalationViewerClient } from "./escalation-viewer-client";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function PublicEscalationViewerPage({ params }: Props) {
  const { token } = await params;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://app.rapidcortex.us";
  const res = await fetch(`${base}/api/escalations/viewer/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as {
    escalation?: EscalationRecord;
    audit?: EscalationAuditEntry[];
    tokenExpired?: boolean;
    error?: string;
  };

  if (!body.escalation) {
    return (
      <div className="min-h-dvh bg-slate-950 px-4 py-12 text-center text-slate-300">
        <p className="text-lg font-semibold">Escalation not found</p>
        <p className="mt-2 text-sm text-slate-500">{body.error ?? "Invalid or unknown viewer token."}</p>
      </div>
    );
  }

  return (
    <EscalationViewerClient
      escalation={body.escalation}
      audit={body.audit ?? []}
      tokenExpired={Boolean(body.tokenExpired)}
    />
  );
}
