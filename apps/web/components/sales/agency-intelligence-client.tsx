"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ProspectingRow = {
  psapId: string;
  agencyName: string;
  state: string;
  county: string;
  salesZoneName: string | null;
  psapClassification: string;
  dispatcherHeadcount: string;
  authorizedStaffing: string;
  vacancies: string;
  annual911Calls: string;
  annualAdministrativeCalls: string;
  cadProvider: string;
  modernizationStatus: string;
  opportunityScore: null;
  dataConfidence: string;
  assignedRepresentative: string;
  lastVerified: string | null;
  nextAction: string | null;
  reportingPeriod: string | null;
  countingMethod: string | null;
  researchReasons: string[];
};

type ListResponse = {
  savedFilter: { name: string; maximumDispatcherHeadcount: number; headcountBasis: string };
  view: string;
  civicIq: { status: string; reason: string };
  fccRegistry: { freshnessNote: string; importStatus: string };
  searchIndex: { note: string };
  opportunityScore: string;
  readPath: string;
  items: ProspectingRow[];
  total: number;
  page: number;
  hasMore: boolean;
  error?: string;
};

const VIEWS = [
  { id: "qualified", label: "Qualified — 7 or fewer" },
  { id: "research", label: "Research required" },
  { id: "excluded", label: "Excluded" },
] as const;

function Unknown({ value }: { value: string | null | undefined }) {
  if (!value || value === "Unknown") {
    return <span className="text-slate-500">Unknown</span>;
  }
  return <span>{value}</span>;
}

export function AgencyIntelligenceClient() {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("qualified");
  const [state, setState] = useState("");
  const [county, setCounty] = useState("");
  const [salesZone, setSalesZone] = useState("");
  const [cadVendor, setCadVendor] = useState("");
  const [basis, setBasis] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams({ view, page: String(page), pageSize: "50" });
    if (state.trim()) params.set("state", state.trim().toUpperCase());
    if (county.trim()) params.set("county", county.trim());
    if (salesZone) params.set("salesZone", salesZone);
    if (cadVendor.trim()) params.set("cadVendor", cadVendor.trim());
    if (basis) params.set("headcountBasis", basis);
    return params.toString();
  }, [view, state, county, salesZone, cadVendor, basis, page]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/rc-admin/psap-prospects/agency-intelligence?${query}`);
      const body = (await response.json()) as ListResponse;
      if (!response.ok) {
        setError(body.error ?? "Could not load Agency Intelligence.");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Could not load Agency Intelligence.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-sky-400">Sales Dashboard</p>
          <h1 className="text-2xl font-semibold text-slate-100">Agency Intelligence</h1>
          <p className="mt-1 text-sm text-slate-400">
            {data?.savedFilter.name ?? "Small Primary PSAPs — 7 or Fewer Dispatchers"}
          </p>
        </div>
        <a
          className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          href={`/api/rc-admin/psap-prospects/agency-intelligence/export?${query}`}
        >
          Export CSV
        </a>
      </header>

      <div className="grid gap-2 text-sm text-slate-300 md:grid-cols-2">
        <p className="rounded-md border border-amber-900/60 bg-amber-950/40 px-3 py-2">
          Civic IQ live sync: {data?.civicIq.status ?? "REQUIRES_CONFIGURATION"}.{" "}
          {data?.civicIq.reason ??
            "A production API key in AWS Secrets Manager is required. The MCP connector is not used."}
        </p>
        <p className="rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2">
          Opportunity score is not calculated yet. FCC import is {data?.fccRegistry.importStatus ?? "NOT_IMPLEMENTED"}.{" "}
          {data?.searchIndex.note}
        </p>
      </div>

      <form
        className="grid gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          setPage(1);
          void load();
        }}
      >
        <label className="text-xs text-slate-400">
          View
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
            value={view}
            onChange={(event) => {
              setView(event.target.value as (typeof VIEWS)[number]["id"]);
              setPage(1);
            }}
          >
            {VIEWS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          State
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm uppercase text-slate-100"
            maxLength={2}
            value={state}
            placeholder="Any"
            onChange={(event) => setState(event.target.value.toUpperCase())}
          />
        </label>
        <label className="text-xs text-slate-400">
          County
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
            value={county}
            onChange={(event) => setCounty(event.target.value)}
          />
        </label>
        <label className="text-xs text-slate-400">
          Sales zone
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
            value={salesZone}
            onChange={(event) => setSalesZone(event.target.value)}
          >
            <option value="">Any</option>
            {["zone-1", "zone-2", "zone-3", "zone-4", "zone-5", "zone-6"].map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-400">
          CAD vendor
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
            value={cadVendor}
            onChange={(event) => setCadVendor(event.target.value)}
          />
        </label>
        <label className="text-xs text-slate-400">
          Headcount basis
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm text-slate-100"
            value={basis}
            onChange={(event) => setBasis(event.target.value)}
          >
            <option value="">Distinct dispatch personnel</option>
            <option value="AUTHORIZED_POSITIONS">Authorized positions</option>
            <option value="FTE">FTE</option>
          </select>
        </label>
      </form>

      <p className="text-xs text-slate-500">
        Default count is distinct dispatch personnel, including part-time staff and dispatch-capable supervisors when
        the source says so. Authorized positions, FTEs, console seats, and people on one shift are separate. Missing
        values stay Unknown. Read path: {data?.readPath ?? "…"}. {data ? `${data.total} matching agencies.` : null}
      </p>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading prospecting view…</p> : null}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-900 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {[
                "Agency",
                "State",
                "Zone",
                "PSAP type",
                "Headcount",
                "Authorized",
                "Vacancies",
                "911 calls",
                "Admin calls",
                "CAD",
                "Modernization",
                "Score",
                "Confidence",
                "Representative",
                "Last verified",
              ].map((heading) => (
                <th key={heading} className="px-3 py-2 font-medium">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((row) => (
              <tr key={row.psapId} className="border-t border-slate-800 hover:bg-slate-900/80">
                <td className="px-3 py-2">
                  <Link className="text-sky-300 hover:underline" href={`/sales/agency-intelligence/${row.psapId}`}>
                    {row.agencyName}
                  </Link>
                  {row.researchReasons.length > 0 ? (
                    <p className="text-xs text-amber-300/90">{row.researchReasons.join(", ")}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2">{row.state}</td>
                <td className="px-3 py-2">{row.salesZoneName ?? "Unknown"}</td>
                <td className="px-3 py-2">{row.psapClassification}</td>
                <td className="px-3 py-2">
                  <Unknown value={row.dispatcherHeadcount} />
                  {row.reportingPeriod ? <p className="text-xs text-slate-500">{row.reportingPeriod}</p> : null}
                </td>
                <td className="px-3 py-2">
                  <Unknown value={row.authorizedStaffing} />
                </td>
                <td className="px-3 py-2">
                  <Unknown value={row.vacancies} />
                </td>
                <td className="px-3 py-2">
                  <Unknown value={row.annual911Calls} />
                </td>
                <td className="px-3 py-2">
                  <Unknown value={row.annualAdministrativeCalls} />
                </td>
                <td className="px-3 py-2">
                  <Unknown value={row.cadProvider} />
                </td>
                <td className="px-3 py-2">{row.modernizationStatus}</td>
                <td className="px-3 py-2 text-slate-500">Unknown</td>
                <td className="px-3 py-2">{row.dataConfidence}</td>
                <td className="px-3 py-2">{row.assignedRepresentative}</td>
                <td className="px-3 py-2">{row.lastVerified ?? "Unknown"}</td>
              </tr>
            ))}
            {!loading && data && data.items.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-slate-400" colSpan={15}>
                  No agencies in this view. Verified primary PSAPs with seven or fewer distinct dispatchers appear
                  here after a reviewer approves the staffing evidence. Agencies with unknown headcount are in
                  Research required.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded border border-slate-700 px-3 py-1 text-sm disabled:opacity-40"
          disabled={page <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </button>
        <span className="text-sm text-slate-400">Page {page}</span>
        <button
          type="button"
          className="rounded border border-slate-700 px-3 py-1 text-sm disabled:opacity-40"
          disabled={!data?.hasMore}
          onClick={() => setPage((current) => current + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
