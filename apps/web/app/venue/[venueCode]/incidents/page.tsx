"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { use, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { IncidentStatus, IncidentType } from "../_lib/venue-types";
import { IncidentSourceBadge } from "../_components/IncidentSourceBadge";
import { IncidentStatusBadge } from "../_components/IncidentStatusBadge";
import { IncidentTypeIcon, incidentTypeLabel } from "../_components/IncidentTypeIcon";
import { RelativeTime } from "../_components/RelativeTime";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";

const statusFilters: Array<IncidentStatus | "all"> = [
  "all",
  "open",
  "assigned",
  "responding",
  "resolved",
  "escalated",
];

const typeFilters: Array<IncidentType | "all"> = [
  "all",
  "medical",
  "security",
  "lost_person",
  "maintenance",
  "guest_services",
  "other",
];

type VenueIncidentsParams = { venueCode: string };

export default function VenueIncidentsPage({
  params,
}: {
  params: Promise<VenueIncidentsParams>;
}) {
  const { venueCode } = use(params);
  const normalizedVenue = venueCode.toUpperCase();
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<IncidentType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const incidentsQuery = useQuery({
    queryKey: ["venue-incidents", normalizedVenue],
    queryFn: () => fetchVenueIncidents(normalizedVenue),
    refetchInterval: 15_000,
  });

  const filteredIncidents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const rows = incidentsQuery.data ?? [];
    return rows.filter((incident) => {
      const statusMatch = statusFilter === "all" ? true : incident.status === statusFilter;
      const typeMatch = typeFilter === "all" ? true : incident.type === typeFilter;
      const searchMatch =
        normalizedQuery.length === 0
          ? true
          : `${incident.id} ${incident.zoneLabel} ${incident.description}`.toLowerCase().includes(normalizedQuery);
      return statusMatch && typeMatch && searchMatch;
    });
  }, [incidentsQuery.data, searchQuery, statusFilter, typeFilter]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-white">Active Incidents</h1>
        <button
          type="button"
          onClick={() => console.log("TODO: create incident")}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          New Incident
        </button>
      </div>

      <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {statusFilters.map((status) => (
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
              {status}
            </button>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as IncidentType | "all")}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
          >
            {typeFilters.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by ID, zone, or description"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none md:col-span-2"
          />
        </div>
      </div>

      {incidentsQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading incidents…</p>
      ) : incidentsQuery.isError ? (
        <p className="text-sm text-red-400">Unable to load incidents.</p>
      ) : (
        <>
          <p className="text-sm text-slate-400">{filteredIncidents.length} incidents</p>

          {filteredIncidents.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-slate-700/60 bg-slate-900/40">
              <table className="min-w-full">
                <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Assigned To</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.map((incident) => (
                    <tr key={incident.id} className="border-b border-slate-800/70 bg-slate-900/20 even:bg-slate-900/40">
                      <td className="px-4 py-3 text-sm font-medium text-sky-300">{incident.id}</td>
                      <td className="px-4 py-3 text-sm text-slate-200">{incident.zoneLabel}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 text-sm text-slate-200">
                          <IncidentTypeIcon type={incident.type} />
                          {incidentTypeLabel(incident.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <IncidentSourceBadge source={incident.source} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="rounded-full border border-slate-700/80 bg-slate-900 px-2 py-1 text-xs uppercase text-slate-300">
                          {incident.confidence}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <IncidentStatusBadge status={incident.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{incident.assignedTo ?? "Unassigned"}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        <RelativeTime iso={incident.createdAt} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link
                            href={`/app/venue/${venueCode}/incidents/${incident.id}`}
                            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            onClick={() => console.log("TODO: assign", incident.id)}
                            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
                          >
                            Assign
                          </button>
                          {incident.status !== "resolved" ? (
                            <button
                              type="button"
                              onClick={() => console.log("TODO: resolve", incident.id)}
                              className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800"
                            >
                              Resolve
                            </button>
                          ) : null}
                          {incident.status !== "escalated" && incident.status !== "resolved" ? (
                            <button
                              type="button"
                              onClick={() => console.log("TODO: escalate to Core", incident.id)}
                              className="rounded-md border border-violet-500/50 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-300 hover:bg-violet-500/20"
                            >
                              Escalate
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-60 flex-col items-center justify-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/40 text-center">
              <AlertTriangle className="h-8 w-8 text-slate-500" />
              <h2 className="text-lg font-semibold text-slate-200">No incidents match your filters</h2>
              <p className="text-sm text-slate-400">Try changing the status, type, or search query.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
