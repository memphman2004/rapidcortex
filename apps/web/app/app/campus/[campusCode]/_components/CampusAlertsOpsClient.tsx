"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CampusAlertBroadcastClassification,
  CampusAlertsEmergencyPreview,
  CampusAlertsUsageRecordStaff,
} from "rapid-cortex-shared";
import { CampusAlertsEmergencyConfirmDialog } from "@/components/campus/campus-alerts-emergency-confirm-dialog";
import { isCampusAlertsEnabled } from "@/lib/runtime-flags";

type Metrics = {
  universityName: string;
  totals: {
    active: number;
    renewalDue30: number;
    expired: number;
    unsubscribed: number;
    suppressed: number;
    total: number;
  };
  items: Array<{
    subscriptionId: string;
    status: string;
    maskedPhone: string;
    renewalDueAt?: string;
    registrationCreatedAt: string;
  }>;
};

type Outreach = {
  renewalsDue30: number;
  emailTemplate: string;
  newsletterCopy: string;
  instructorAnnouncement: string;
  portalBanner: string;
  qrNfcReminder: string;
};

const EMERGENCY_CLASSIFICATIONS: CampusAlertBroadcastClassification[] = [
  "EMERGENCY",
  "EMERGENCY_UPDATE",
  "ALL_CLEAR",
];

async function fetchMetrics(campusCode: string): Promise<Metrics> {
  const res = await fetch(`/api/campus/code/${encodeURIComponent(campusCode)}/campus-alerts`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load Campus Alerts");
  return res.json() as Promise<Metrics>;
}

async function fetchUsage(campusCode: string): Promise<{ items: CampusAlertsUsageRecordStaff[] }> {
  const res = await fetch(`/api/campus/code/${encodeURIComponent(campusCode)}/campus-alerts/usage`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load usage");
  return res.json() as Promise<{ items: CampusAlertsUsageRecordStaff[] }>;
}

async function fetchOutreach(campusCode: string): Promise<Outreach> {
  const res = await fetch(
    `/api/campus/code/${encodeURIComponent(campusCode)}/campus-alerts/renewal-outreach`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Failed to load outreach pack");
  return res.json() as Promise<Outreach>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
    </div>
  );
}

export function CampusAlertsOpsClient({ campusCode }: { campusCode: string }) {
  const flagOn = isCampusAlertsEnabled();
  const q = useQuery({
    queryKey: ["campus-alerts", campusCode],
    queryFn: () => fetchMetrics(campusCode),
    enabled: flagOn,
    refetchInterval: 60_000,
  });
  const usageQ = useQuery({
    queryKey: ["campus-alerts-usage", campusCode],
    queryFn: () => fetchUsage(campusCode),
    enabled: flagOn,
  });
  const outreachQ = useQuery({
    queryKey: ["campus-alerts-outreach", campusCode],
    queryFn: () => fetchOutreach(campusCode),
    enabled: flagOn,
  });

  const [classification, setClassification] =
    useState<CampusAlertBroadcastClassification>("EMERGENCY");
  const [messageBody, setMessageBody] = useState("");
  const [affectedAreasLabel, setAffectedAreasLabel] = useState("");
  const [preview, setPreview] = useState<CampusAlertsEmergencyPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<string | null>(null);

  async function runPreview() {
    setBusy(true);
    setSendError(null);
    setSendResult(null);
    const res = await fetch(
      `/api/campus/code/${encodeURIComponent(campusCode)}/campus-alerts/emergency/preview`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classification,
          messageBody,
          affectedAreasLabel: affectedAreasLabel || undefined,
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as CampusAlertsEmergencyPreview & {
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setSendError(data.error ?? "Preview failed");
      return;
    }
    setPreview(data);
    setAck(false);
    setDialogOpen(true);
  }

  async function runConfirm() {
    if (!preview) return;
    setBusy(true);
    setSendError(null);
    const res = await fetch(
      `/api/campus/code/${encodeURIComponent(campusCode)}/campus-alerts/emergency/confirm`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          previewId: preview.previewId,
          classification: preview.classification,
          messageBody: preview.messagePreview,
          expectedRecipientCount: preview.cost.recipientCount,
          expectedEstimatedSegments: preview.cost.estimatedSegments,
          billingAcknowledgment: true,
          emergencyConfirmation: true,
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      campaignId?: string;
      submitted?: number;
      failed?: number;
      status?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setSendError(data.error ?? "Send failed");
      if (res.status === 409) {
        setDialogOpen(false);
        setPreview(null);
      }
      return;
    }
    setDialogOpen(false);
    setPreview(null);
    setAck(false);
    setMessageBody("");
    setSendResult(
      `Emergency broadcast ${data.campaignId} ${data.status}: ${data.submitted ?? 0} submitted, ${data.failed ?? 0} failed. Provider acceptance is not confirmed handset delivery.`,
    );
    void usageQ.refetch();
  }

  if (!flagOn) {
    return (
      <div className="p-6 text-sm text-slate-400">
        Campus Alerts is disabled. Enable platform flag{" "}
        <code className="text-slate-200">NEXT_PUBLIC_ENABLE_CAMPUS_ALERTS</code> and tenant{" "}
        <code className="text-slate-200">campusAlerts.enabled</code>.
      </div>
    );
  }

  if (q.isLoading) {
    return <div className="p-6 text-sm text-slate-400">Loading Campus Alerts…</div>;
  }

  if (q.isError || !q.data) {
    return (
      <div className="p-6 text-sm text-red-300">
        Unable to load Campus Alerts subscribers for this campus.
      </div>
    );
  }

  const { universityName, totals, items } = q.data;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Campus Alerts</h1>
        <p className="mt-1 text-sm text-slate-400">
          Optional subscriber registry for {universityName}. Mass SMS is emergency-only and
          institution-billable. Annual renewal uses QR/NFC and university communications — not mass
          SMS.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Subscribers
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label="Active subscribers" value={totals.active} />
          <Metric label="Renewals due (30 days)" value={totals.renewalDue30} />
          <Metric label="Expired" value={totals.expired} />
          <Metric label="Unsubscribed" value={totals.unsubscribed} />
          <Metric label="Suppressed" value={totals.suppressed} />
          <Metric label="Total records" value={totals.total} />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-red-900/50 bg-red-950/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-300">
            Broadcast Center — Emergency SMS
          </h2>
          <span className="rounded bg-red-600/30 px-2 py-0.5 text-xs font-semibold text-red-200">
            Emergency Only
          </span>
        </div>
        <p className="text-sm text-slate-400">
          Routine, advisory, and annual renewal notices cannot send mass SMS. Individual OTP
          verification SMS remains available on the public QR/NFC registration flow.
        </p>
        <label className="block text-sm text-slate-300">
          Emergency classification
          <select
            className="mt-1 w-full min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3"
            value={classification}
            onChange={(e) =>
              setClassification(e.target.value as CampusAlertBroadcastClassification)
            }
          >
            {EMERGENCY_CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm text-slate-300">
          Target campus / affected areas
          <input
            className="mt-1 w-full min-h-11 rounded-lg border border-slate-700 bg-slate-900 px-3"
            value={affectedAreasLabel}
            onChange={(e) => setAffectedAreasLabel(e.target.value)}
            placeholder="All campuses"
          />
        </label>
        <label className="block text-sm text-slate-300">
          Message
          <textarea
            className="mt-1 w-full min-h-28 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            maxLength={1000}
            placeholder="Emergency message for eligible Campus Alerts subscribers…"
          />
        </label>
        {sendError && !dialogOpen ? (
          <p className="text-sm text-red-300" role="alert">
            {sendError}
          </p>
        ) : null}
        {sendResult ? (
          <p className="text-sm text-emerald-300" role="status">
            {sendResult}
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy || messageBody.trim().length < 1}
          onClick={() => void runPreview()}
          className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          Review emergency broadcast…
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Annual Verification (non-SMS)
        </h2>
        <p className="mb-3 text-sm text-slate-400">
          Use university email, instructors, newsletters, campus portal banners, and QR/NFC
          Information tab messaging. Mass SMS renewal campaigns are not available.
        </p>
        {outreachQ.data ? (
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              Renewals due within 30 days:{" "}
              <span className="font-semibold text-slate-100">{outreachQ.data.renewalsDue30}</span>
            </p>
            <details className="rounded-lg border border-slate-700 p-3">
              <summary className="cursor-pointer font-medium">Email template</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-400">
                {outreachQ.data.emailTemplate}
              </pre>
            </details>
            <details className="rounded-lg border border-slate-700 p-3">
              <summary className="cursor-pointer font-medium">Newsletter copy</summary>
              <p className="mt-2 text-xs text-slate-400">{outreachQ.data.newsletterCopy}</p>
            </details>
            <details className="rounded-lg border border-slate-700 p-3">
              <summary className="cursor-pointer font-medium">Instructor announcement</summary>
              <p className="mt-2 text-xs text-slate-400">{outreachQ.data.instructorAnnouncement}</p>
            </details>
            <details className="rounded-lg border border-slate-700 p-3">
              <summary className="cursor-pointer font-medium">Portal banner</summary>
              <p className="mt-2 text-xs text-slate-400">{outreachQ.data.portalBanner}</p>
            </details>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading renewal outreach materials…</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Emergency SMS Usage
        </h2>
        <div className="overflow-hidden rounded-xl border border-slate-700/80">
          {(usageQ.data?.items.length ?? 0) === 0 ? (
            <p className="p-4 text-sm text-slate-500">No emergency SMS campaigns yet.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {usageQ.data!.items.map((u) => (
                <li key={u.campaignId} className="px-4 py-3 text-sm text-slate-200">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-medium text-red-300">{u.emergencyClassification}</span>
                    <span className="text-slate-500">
                      {new Date(u.createdAt).toLocaleString()}
                    </span>
                    <span className="text-slate-400">{u.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Recipients {u.recipientCount.toLocaleString()} · Segments submitted{" "}
                    {u.submittedSegments.toLocaleString()} · Est. {u.estimatedCostUsd.toFixed(2)}{" "}
                    USD · Period {u.billingPeriod} · {u.contractualBillingMode}
                    {u.reconciledCostUsd != null
                      ? ` · Reconciled ${u.reconciledCostUsd.toFixed(2)} USD`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-700/80">
        <h2 className="border-b border-slate-700/80 px-4 py-3 text-sm font-semibold text-slate-200">
          Recent registrations (masked)
        </h2>
        {items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No subscribers yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {items.map((item) => (
              <li key={item.subscriptionId} className="px-4 py-3 text-sm text-slate-200">
                <span className="font-medium">{item.maskedPhone}</span>
                <span className="mx-2 text-slate-500">·</span>
                <span className="text-slate-400">{item.status}</span>
                {item.renewalDueAt ? (
                  <span className="ml-2 text-slate-500">
                    renew by {new Date(item.renewalDueAt).toLocaleDateString()}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <CampusAlertsEmergencyConfirmDialog
        open={dialogOpen}
        preview={preview}
        busy={busy}
        error={sendError}
        acknowledgment={ack}
        onAcknowledgmentChange={setAck}
        onCancel={() => {
          setDialogOpen(false);
          setAck(false);
          setSendError(null);
        }}
        onConfirm={() => void runConfirm()}
      />
    </div>
  );
}
