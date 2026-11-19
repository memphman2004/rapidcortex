"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";

type Evidence = {
  evidenceId: string;
  field: string;
  proposedValue: string | number | boolean;
  countingMethod: string | null;
  sourceType: string;
  quotedPassage: string | null;
  reportingPeriod: string | null;
  verificationStatus: string;
  decision: string | null;
  contactRole: string | null;
};

type ProfileResponse = {
  prospect: {
    psapId: string;
    psapName: string;
    state: string;
    county: string;
    city: string;
    phone: string;
    outreachStatus: string;
    assignedToName: string | null;
    nextActionNote: string | null;
    leadsCrmLeadId: string | null;
    website: string | null;
  };
  profile: {
    psapClassification: { value: string | null; verificationStatus: string; reportingPeriod: string | null };
    primaryReceivingPoint: { value: boolean | null; verificationStatus: string };
    fccPsapId: { value: string | null; verificationStatus: string };
    staffing: {
      reportedDispatcherHeadcount: {
        value: number | null;
        verificationStatus: string;
        countingMethod: string | null;
        reportingPeriod: string | null;
        reportDate: string | null;
      };
      authorizedDispatcherPositions: { value: number | null; verificationStatus: string };
      filledDispatcherPositions: { value: number | null; verificationStatus: string };
      dispatcherVacancies: { value: number | null; verificationStatus: string };
      dispatcherFte: { value: number | null; verificationStatus: string };
    };
    callVolume: {
      annual911Calls: { value: number | null; verificationStatus: string; reportingPeriod: string | null };
      annualAdministrativeCalls: { value: number | null; verificationStatus: string };
      annualNonEmergencyCalls: { value: number | null; verificationStatus: string };
    };
    technology: { cadProvider: { value: string | null; verificationStatus: string }; namedBidders: string[] };
    modernization: { status: { value: string | null; verificationStatus: string }; activeRfp: { value: boolean | null } };
    evidence: Evidence[];
  } | null;
  vacancyPercentage: number | null;
  activeRfp: boolean | null;
  staleFields: Array<{ field: string; stale: boolean }>;
  pendingEvidence: Evidence[];
  civicIq: { status: string; reason: string };
  canVerify: boolean;
  error?: string;
};

function showCount(value: number | null | undefined): string {
  if (value === null || value === undefined) return "Unknown";
  return String(value);
}

const FIELDS = [
  "psapClassification",
  "primaryReceivingPoint",
  "fccPsapId",
  "reportedDispatcherHeadcount",
  "authorizedDispatcherPositions",
  "filledDispatcherPositions",
  "dispatcherVacancies",
  "dispatcherFte",
  "annual911Calls",
  "annualAdministrativeCalls",
  "annualNonEmergencyCalls",
  "cadProvider",
  "modernizationStatus",
  "activeRfp",
  "rfpDeadline",
] as const;

export function AgencyProfileClient({ psapId, canVerify }: { psapId: string; canVerify: boolean }) {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [field, setField] = useState<(typeof FIELDS)[number]>("reportedDispatcherHeadcount");
  const [proposedValue, setProposedValue] = useState("");
  const [countingMethod, setCountingMethod] = useState("DISTINCT_DISPATCH_PERSONNEL");
  const [cadProviderRole, setCadProviderRole] = useState("INCUMBENT");
  const [sourceType, setSourceType] = useState("OFFICIAL_REPORT");
  const [reportingPeriod, setReportingPeriod] = useState("");
  const [sourcePublishedAt, setSourcePublishedAt] = useState("");
  const [quotedPassage, setQuotedPassage] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/rc-admin/psap-prospects/${encodeURIComponent(psapId)}/agency-intelligence`);
    const body = (await response.json()) as ProfileResponse;
    if (!response.ok) {
      setError(body.error ?? "Could not load this agency.");
      return;
    }
    setData(body);
    setError(null);
  }, [psapId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitEvidence(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    const numeric = [
      "reportedDispatcherHeadcount",
      "authorizedDispatcherPositions",
      "filledDispatcherPositions",
      "dispatcherVacancies",
      "annual911Calls",
      "annualAdministrativeCalls",
      "annualNonEmergencyCalls",
    ].includes(field);
    const boolField = field === "primaryReceivingPoint" || field === "activeRfp";
    const value: string | number | boolean = numeric
      ? Number(proposedValue)
      : boolField
        ? proposedValue === "true"
        : field === "dispatcherFte"
          ? Number(proposedValue)
          : proposedValue.trim();
    const response = await fetch(
      `/api/rc-admin/psap-prospects/${encodeURIComponent(psapId)}/agency-intelligence/evidence`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          field,
          proposedValue: value,
          countingMethod: field === "reportedDispatcherHeadcount" ? countingMethod : null,
          cadProviderRole: field === "cadProvider" ? cadProviderRole : null,
          sourceType,
          reportingPeriod: reportingPeriod.trim() || null,
          sourcePublishedAt: sourcePublishedAt.trim() || null,
          quotedPassage: quotedPassage.trim() || null,
          contactRole: contactRole.trim() || null,
          sourceUrl: sourceUrl.trim() || null,
          confidence: "MEDIUM",
        }),
      },
    );
    const body = (await response.json()) as { error?: string; outcome?: string };
    if (!response.ok) {
      setError(body.error ?? "Evidence was not saved.");
      return;
    }
    setMessage(body.outcome === "duplicate" ? "That claim is already waiting for review." : "Submitted for review.");
    setProposedValue("");
    setQuotedPassage("");
    await load();
  }

  async function decide(evidenceId: string, action: "approve" | "reject" | "approve_over_conflict") {
    setMessage(null);
    const response = await fetch(
      `/api/rc-admin/psap-prospects/${encodeURIComponent(psapId)}/agency-intelligence/decisions`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ evidenceId, action }),
      },
    );
    const body = (await response.json()) as { error?: string; outcome?: string };
    setMessage(body.error ?? `Decision recorded: ${body.outcome ?? "saved"}.`);
    await load();
  }

  const profile = data?.profile;
  const staffing = profile?.staffing.reportedDispatcherHeadcount;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Link className="text-sm text-sky-300 hover:underline" href="/sales/agency-intelligence">
        Back to Agency Intelligence
      </Link>
      <header>
        <p className="text-xs uppercase tracking-wide text-sky-400">Agency profile</p>
        <h1 className="text-2xl font-semibold">{data?.prospect.psapName ?? "Agency"}</h1>
        <p className="text-sm text-slate-400">
          {[data?.prospect.city, data?.prospect.county, data?.prospect.state].filter(Boolean).join(", ")}
        </p>
      </header>

      <p className="rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
        Civic IQ: {data?.civicIq.status ?? "REQUIRES_CONFIGURATION"}. {data?.civicIq.reason}
      </p>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {message ? <p className="text-sm text-slate-200">{message}</p> : null}

      <section className="grid gap-3 rounded-lg border border-slate-800 p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Overview</h2>
        <Fact label="PSAP type" value={profile?.psapClassification.value ?? "Unknown"} detail={profile?.psapClassification.verificationStatus} />
        <Fact label="Primary receiving point" value={profile?.primaryReceivingPoint.value == null ? "Unknown" : String(profile.primaryReceivingPoint.value)} />
        <Fact label="FCC PSAP ID" value={profile?.fccPsapId.value ?? "Unknown"} />
        <Fact label="Assigned representative" value={data?.prospect.assignedToName ?? "Unassigned"} />
        <Fact label="Sales stage" value={data?.prospect.outreachStatus ?? "Unknown"} />
        <Fact label="Linked opportunity" value={data?.prospect.leadsCrmLeadId ?? "None"} />
        <Fact label="Next action" value={data?.prospect.nextActionNote ?? "None"} />
        <Fact label="Public phone" value={data?.prospect.phone ?? "Unknown"} />
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-800 p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Staffing and workload</h2>
        <Fact
          label="Distinct dispatcher headcount"
          value={showCount(staffing?.value)}
          detail={[staffing?.countingMethod, staffing?.reportingPeriod, staffing?.reportDate, staffing?.verificationStatus].filter(Boolean).join(" · ")}
        />
        <Fact label="Authorized positions" value={showCount(profile?.staffing.authorizedDispatcherPositions.value)} detail={profile?.staffing.authorizedDispatcherPositions.verificationStatus} />
        <Fact label="Filled positions" value={showCount(profile?.staffing.filledDispatcherPositions.value)} />
        <Fact label="Vacancies" value={showCount(profile?.staffing.dispatcherVacancies.value)} />
        <Fact label="Vacancy percentage" value={data?.vacancyPercentage == null ? "Unknown" : `${data.vacancyPercentage}%`} />
        <Fact label="FTE" value={showCount(profile?.staffing.dispatcherFte.value)} />
        <Fact label="Annual 911 calls" value={showCount(profile?.callVolume.annual911Calls.value)} detail={profile?.callVolume.annual911Calls.reportingPeriod ?? undefined} />
        <Fact label="Annual administrative calls" value={showCount(profile?.callVolume.annualAdministrativeCalls.value)} />
        <Fact label="Annual non-emergency calls" value={showCount(profile?.callVolume.annualNonEmergencyCalls.value)} />
        {data?.staleFields.length ? (
          <p className="md:col-span-2 text-sm text-amber-200">
            Stale fields: {data.staleFields.map((item) => item.field).join(", ")}. No replacement value was invented.
          </p>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-lg border border-slate-800 p-4 md:grid-cols-2">
        <h2 className="md:col-span-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Technology and procurement</h2>
        <Fact label="CAD incumbent" value={profile?.technology.cadProvider.value ?? "Unknown"} detail={profile?.technology.cadProvider.verificationStatus} />
        <Fact label="Named bidders" value={profile?.technology.namedBidders.length ? profile.technology.namedBidders.join(", ") : "None recorded"} />
        <Fact label="Modernization" value={profile?.modernization.status.value ?? "Unknown"} />
        <Fact label="Active RFP" value={data?.activeRfp == null ? "Unknown" : data.activeRfp ? "Open" : "Not open"} />
      </section>

      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Research sources</h2>
        <ul className="mt-3 space-y-3">
          {(profile?.evidence ?? []).map((item) => (
            <li key={item.evidenceId} className="rounded border border-slate-800 p-3 text-sm">
              <p className="font-medium text-slate-100">
                {item.field}: {String(item.proposedValue)}{" "}
                <span className="text-slate-400">
                  {item.decision ?? "PENDING"} · {item.verificationStatus}
                  {item.countingMethod ? ` · ${item.countingMethod}` : ""}
                  {item.reportingPeriod ? ` · ${item.reportingPeriod}` : ""}
                </span>
              </p>
              {item.quotedPassage ? <p className="mt-1 text-slate-300">“{item.quotedPassage}”</p> : null}
              {item.contactRole ? <p className="text-slate-400">Confirmed by: {item.contactRole}</p> : null}
              {canVerify && item.decision === "PENDING" ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="rounded bg-sky-700 px-2 py-1 text-xs" onClick={() => void decide(item.evidenceId, "approve")}>
                    Approve
                  </button>
                  <button type="button" className="rounded bg-slate-700 px-2 py-1 text-xs" onClick={() => void decide(item.evidenceId, "reject")}>
                    Reject
                  </button>
                  {item.verificationStatus === "CONFLICTING" ? (
                    <button type="button" className="rounded bg-amber-800 px-2 py-1 text-xs" onClick={() => void decide(item.evidenceId, "approve_over_conflict")}>
                      Approve over conflict
                    </button>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
          {!profile?.evidence.length ? <li className="text-sm text-slate-500">No evidence recorded.</li> : null}
        </ul>
      </section>

      <form className="grid gap-3 rounded-lg border border-slate-800 p-4" onSubmit={(event) => void submitEvidence(event)}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Manual research</h2>
        <p className="text-sm text-slate-400">
          Submissions wait for review. They do not change the qualified list until an RC admin approves them.
        </p>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
          Field
          <select className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm" value={field} onChange={(event) => setField(event.target.value as (typeof FIELDS)[number])}>
            {FIELDS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
          Value
          {field === "primaryReceivingPoint" || field === "activeRfp" ? (
            <select
              className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
              value={proposedValue}
              onChange={(event) => setProposedValue(event.target.value)}
              required
            >
              <option value="">Select</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : (
            <input
              className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
              value={proposedValue}
              onChange={(event) => setProposedValue(event.target.value)}
              required
            />
          )}
        </label>
        {field === "reportedDispatcherHeadcount" ? (
          <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
            Counting method
            <select className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm" value={countingMethod} onChange={(event) => setCountingMethod(event.target.value)}>
              <option value="DISTINCT_DISPATCH_PERSONNEL">Distinct dispatch personnel</option>
              <option value="AUTHORIZED_POSITIONS">Authorized positions</option>
              <option value="FILLED_POSITIONS">Filled positions</option>
              <option value="FULL_TIME_ONLY">Full-time only</option>
              <option value="FTE">FTE</option>
              <option value="CONSOLE_POSITIONS">Console positions</option>
              <option value="ON_DUTY_SHIFT">On-duty shift</option>
            </select>
          </label>
        ) : null}
        {field === "cadProvider" ? (
          <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
            Vendor role
            <select className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm" value={cadProviderRole} onChange={(event) => setCadProviderRole(event.target.value)}>
              <option value="INCUMBENT">Incumbent</option>
              <option value="BIDDER">Bidder only</option>
            </select>
          </label>
        ) : null}
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
          Source
          <select className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <option value="OFFICIAL_REPORT">Official report</option>
            <option value="OFFICIAL_BUDGET">Official budget</option>
            <option value="STATE_DIRECTORY">State directory</option>
            <option value="AGENCY_CONFIRMATION">Agency confirmation</option>
            <option value="PROCUREMENT_RECORD">Procurement record</option>
            <option value="JOB_POSTING">Job posting</option>
            <option value="MANUAL_RESEARCH">Manual research</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
          Reporting period
          <input className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm" value={reportingPeriod} onChange={(event) => setReportingPeriod(event.target.value)} placeholder="FY2026" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
          Source date
          <input className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm" value={sourcePublishedAt} onChange={(event) => setSourcePublishedAt(event.target.value)} placeholder="2026-06-01" />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
          Source URL
          <input className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
          Quoted passage
          <textarea className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm" rows={3} value={quotedPassage} onChange={(event) => setQuotedPassage(event.target.value)} />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-400">
          Contact role, if the agency confirmed it
          <input className="block w-full min-w-0 rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm" value={contactRole} onChange={(event) => setContactRole(event.target.value)} />
        </label>
        <button type="submit" className="w-fit rounded bg-sky-700 px-3 py-2 text-sm font-medium">
          Submit for verification
        </button>
      </form>
    </div>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={value === "Unknown" ? "text-slate-500" : "text-slate-100"}>{value}</p>
      {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}
