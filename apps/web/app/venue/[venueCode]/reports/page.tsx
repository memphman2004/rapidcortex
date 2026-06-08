"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { MessageSquare } from "lucide-react";
import { FIXTURE_INCIDENTS } from "../_lib/venue-fixtures";
import type { IncidentSource } from "../_lib/venue-types";
import { IncidentSourceBadge } from "../_components/IncidentSourceBadge";
import { RelativeTime } from "../_components/RelativeTime";

type ReportStatusFilter = "all" | "new" | "converted" | "closed";
type SourceFilter = "all" | IncidentSource;

function deriveReportStatus(status: string): Exclude<ReportStatusFilter, "all"> {
  if (status === "resolved") return "closed";
  if (status === "open") return "new";
  return "converted";
}

export default function GuestReportsPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ReportStatusFilter>("all");

  const guestReports = useMemo(
    () => FIXTURE_INCIDENTS.filter((incident) => incident.source === "qr" || incident.source === "sms"),
    [],
  );

  const filtered = useMemo(() => {
    return guestReports.filter((report) => {
      const reportStatus = deriveReportStatus(report.status);
      const sourceMatch = sourceFilter === "all" ? true : report.source === sourceFilter;
      const statusMatch = statusFilter === "all" ? true : reportStatus === statusFilter;
      return sourceMatch && statusMatch;
    });
  }, [guestReports, sourceFilter, statusFilter]);

  const totalToday = guestReports.length;
  const qrCount = guestReports.filter((report) => report.source === "qr").length;
  const smsCount = guestReports.filter((report) => report.source === "sms").length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Guest Reports</h1>
        <p className="mt-1 text-sm text-slate-400">
          Reports submitted by guests via QR code or SMS. Route to security or mark resolved — this is
          not a 911 emergency dispatch system.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{totalToday}</p>
          <p className="text-sm text-slate-400">Total Today</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{qrCount}</p>
          <p className="text-sm text-slate-400">Via QR Code</p>
        </div>
        <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
          <p className="text-2xl font-bold text-white">{smsCount}</p>
          <p className="text-sm text-slate-400">Via SMS</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-wrap gap-2">
            {(["all", "qr", "sms"] as SourceFilter[]).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setSourceFilter(source)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  sourceFilter === source
                    ? "border-sky-400 bg-sky-500/20 text-sky-200"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {source === "all" ? "All" : source === "qr" ? "QR Code" : "SMS"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {(["all", "new", "converted", "closed"] as ReportStatusFilter[]).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  statusFilter === status
                    ? "border-sky-400 bg-sky-500/20 text-sky-200"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                {status === "converted" ? "Converted to Incident" : status}
              </button>
            ))}
          </div>
        </div>
      </section>

      {filtered.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-slate-700/60 bg-slate-900/40">
          <table className="min-w-full">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-300">
              <tr>
                <th className="px-4 py-3">Report ID</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Media</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => {
                const reportStatus = deriveReportStatus(report.status);
                const isConverted = reportStatus === "converted" || reportStatus === "closed";
                return (
                  <tr key={report.id} className="border-b border-slate-800/70 bg-slate-900/20 even:bg-slate-900/40">
                    <td className="px-4 py-3 text-sm font-medium text-sky-300">{report.id}</td>
                    <td className="px-4 py-3 text-sm text-slate-200">{report.zoneLabel}</td>
                    <td className="px-4 py-3">
                      <IncidentSourceBadge source={report.source} />
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{report.description.slice(0, 60)}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{report.hasMedia ? "Yes" : "No"}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">
                      <RelativeTime iso={report.createdAt} />
                    </td>
                    <td className="px-4 py-3">
                      {isConverted ? (
                        <Link
                          href={`/app/venue/${venueCode}/incidents/${report.id}`}
                          className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
                        >
                          View Incident
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => console.log("TODO: create incident", report.id)}
                          className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
                        >
                          Create Incident
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex min-h-60 flex-col items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/40 text-center">
          <MessageSquare className="h-8 w-8 text-slate-500" />
          <h2 className="text-lg font-semibold text-slate-100">No guest reports yet.</h2>
          <p className="max-w-lg text-sm text-slate-400">
            Reports arrive when guests scan a QR code or text your venue code to 723389
          </p>
        </div>
      )}
    </div>
  );
}
