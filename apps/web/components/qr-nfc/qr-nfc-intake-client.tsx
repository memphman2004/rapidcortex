"use client";

import { useState } from "react";
import type { QRNFCPublicRecord, ReportMedium } from "rapid-cortex-shared";
import { qrNfcCallButtonLabel } from "rapid-cortex-shared";

const VERTICAL_COPY: Record<
  string,
  { header: string; subhead: string; button: string; accent: string; bg: string }
> = {
  campus: {
    header: "Report a Safety Concern",
    subhead: "Your report goes directly to campus security.",
    button: "Submit Report",
    accent: "#10B981",
    bg: "#ECFDF5",
  },
  venue: {
    header: "Contact Venue Security",
    subhead: "Your message goes directly to security staff.",
    button: "Send to Security",
    accent: "#F59E0B",
    bg: "#FFFBEB",
  },
  "911": {
    header: "Submit a Report",
    subhead: "Your report goes directly to the communications center.",
    button: "Submit Report",
    accent: "#2979FF",
    bg: "#EFF6FF",
  },
  hospital: {
    header: "Report a Patient Concern",
    subhead: "Your message goes directly to hospital staff.",
    button: "Submit",
    accent: "#EF4444",
    bg: "#FEF2F2",
  },
  transit: {
    header: "Report a Transit Issue",
    subhead: "Your report goes directly to transit security.",
    button: "Submit Report",
    accent: "#6366F1",
    bg: "#EEF2FF",
  },
};

type Props = {
  record: QRNFCPublicRecord;
  medium: ReportMedium;
};

export function QRNfcIntakeClient({ record, medium }: Props) {
  const copy = VERTICAL_COPY[record.vertical] ?? VERTICAL_COPY["911"]!;
  const [message, setMessage] = useState("");
  const [locationNote, setLocationNote] = useState(record.zoneName ?? "");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [anonymous, setAnonymous] = useState(record.reportType === "anonymous");
  const [submitting, setSubmitting] = useState(false);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showIdentity =
    record.reportType === "identified" ||
    (record.reportType === "both" && !anonymous);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrId: record.qrId,
          message,
          locationNote: locationNote || undefined,
          reporterName: showIdentity ? reporterName || undefined : undefined,
          reporterPhone: showIdentity ? reporterPhone || undefined : undefined,
          medium,
        }),
      });
      const body = (await res.json()) as { referenceCode?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Submission failed");
      setReferenceCode(body.referenceCode ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (referenceCode) {
    return (
      <section className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Your report has been received.</h1>
        <p className="mt-3 text-slate-600">Reference: <span className="font-mono font-semibold">{referenceCode}</span></p>
      </section>
    );
  }

  return (
    <section
      className="min-h-screen px-4 py-10"
      style={{ backgroundColor: copy.bg }}
    >
      <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {record.agencyName}
        </p>
        {record.zoneName ? (
          <p className="mt-1 text-sm font-medium text-slate-700">{record.zoneName}</p>
        ) : null}
        <h1 className="mt-3 text-2xl font-semibold" style={{ color: copy.accent }}>
          {copy.header}
        </h1>
        <p className="mt-2 text-sm text-slate-600">{copy.subhead}</p>

        {record.callNumber ? (
          <a
            href={`tel:${record.callNumber}`}
            className="mt-6 block w-full rounded-lg px-4 py-4 text-center text-white no-underline shadow-sm"
            style={{ backgroundColor: copy.accent }}
          >
            <span className="text-lg font-bold tracking-wide">
              📞 {qrNfcCallButtonLabel(record.vertical)}
            </span>
            {record.callNumberDisplay ? (
              <span className="mt-1 block text-sm font-normal opacity-90">
                {record.callNumberDisplay}
              </span>
            ) : null}
          </a>
        ) : null}

        {record.callNumber ? (
          <p className="my-6 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
            — or submit a report —
          </p>
        ) : null}

        <label className={`block text-sm font-medium text-slate-700 ${record.callNumber ? "" : "mt-6"}`}>
          What is happening? *
          <textarea
            required
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={4}
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Your location / zone
          <input
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        {record.reportType === "both" ? (
          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Report anonymously
          </label>
        ) : null}

        {showIdentity ? (
          <>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Your name
              <input
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-slate-700">
              Your phone number
              <input
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </>
        ) : null}

        {error ? <p className="mt-4 text-sm text-rose-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: copy.accent }}
        >
          {submitting ? "Submitting…" : copy.button}
        </button>
      </form>
    </section>
  );
}
