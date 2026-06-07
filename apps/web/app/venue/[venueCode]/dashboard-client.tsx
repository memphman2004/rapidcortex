"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Camera, Circle, ClipboardList, MessageSquare, Users } from "lucide-react";
import { FIXTURE_CAMERAS, FIXTURE_STAFF } from "./_lib/venue-fixtures";
import { QrIncidentLocation } from "@/components/incidents/qr-incident-location";
import { IncidentSourceBadge } from "./_components/IncidentSourceBadge";
import { IncidentRow } from "./_components/IncidentRow";
import { IncidentTypeIcon, incidentTypeLabel } from "./_components/IncidentTypeIcon";
import { RelativeTime } from "./_components/RelativeTime";
import { StatCard } from "./_components/StatCard";
import { fetchVenueIncidents } from "@/lib/venue/venue-incidents-api";
import {
  getVenueDashboardSections,
  getVenueDashboardSubtitle,
  getVenueDashboardTitle,
} from "@/lib/venue/venue-dashboard-sections";

export function VenueDashboardClient({
  venueCode,
  role = "VENUE_SUPERVISOR",
}: {
  venueCode: string;
  role?: string;
}) {
  const normalizedVenue = venueCode.toUpperCase();
  const sections = getVenueDashboardSections(role);
  const title = getVenueDashboardTitle(role);
  const subtitle = getVenueDashboardSubtitle(role);

  const incidentsQuery = useQuery({
    queryKey: ["venue-incidents", normalizedVenue],
    queryFn: () => fetchVenueIncidents(normalizedVenue),
    refetchInterval: 15_000,
  });

  const incidents = incidentsQuery.data ?? [];
  const openCount = incidents.filter((incident) =>
    ["open", "assigned", "responding"].includes(incident.status),
  ).length;
  const respondingCount = incidents.filter((incident) => incident.status === "responding").length;
  const resolvedToday = incidents.filter((incident) => incident.status === "resolved").length;
  const availableStaff = FIXTURE_STAFF.filter((staff) => staff.status === "available").length;
  const activeIncidents = incidents
    .filter((incident) => ["open", "assigned", "responding"].includes(incident.status))
    .slice(0, 5);

  const recentGuestReports = incidents
    .filter((incident) => incident.source === "qr" || incident.source === "sms")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, sections.activeIncidentsTable ? 5 : 8);

  const venueBase = `/app/venue/${venueCode}`;

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-orange-900/30 bg-orange-950/10 px-4 py-3">
        <h1 className="text-lg font-semibold text-orange-50">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-orange-100/70">{subtitle}</p>
      </header>

      {sections.opsStats ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Open Incidents"
            value={openCount}
            icon={ClipboardList}
            alert={openCount > 0}
            href={`${venueBase}/incidents`}
          />
          <StatCard label="Responding Now" value={respondingCount} icon={Users} trend="neutral" />
          <StatCard label="Resolved Today" value={resolvedToday} icon={ClipboardList} trend="up" />
          {sections.staffAvailableStat ? (
            <StatCard label="Staff Available" value={availableStaff} icon={Users} trend="neutral" />
          ) : null}
        </section>
      ) : null}

      {sections.activeIncidentsTable ? (
        <section className="rounded-lg border border-slate-700/60 bg-slate-900/40">
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
            <h2 className="text-lg font-semibold text-white">Active Incidents</h2>
            <Link href={`${venueBase}/incidents`} className="text-sm font-semibold text-orange-300 hover:text-orange-200">
              View all
            </Link>
          </div>
          {incidentsQuery.isLoading ? (
            <p className="p-6 text-sm text-slate-400">Loading incidents…</p>
          ) : incidentsQuery.isError ? (
            <p className="p-6 text-sm text-red-400">Unable to load incidents. Retrying every 15 seconds.</p>
          ) : activeIncidents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-300">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Zone</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>{activeIncidents.map((incident) => <IncidentRow key={incident.id} incident={incident} />)}</tbody>
              </table>
            </div>
          ) : (
            <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
              <ClipboardList className="h-8 w-8 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-200">No active incidents</h3>
              <p className="text-sm text-slate-400">New incidents from QR and SMS reports will appear here.</p>
            </div>
          )}
        </section>
      ) : null}

      {sections.guestReportsFeed ? (
        <section
          className={`rounded-lg border border-slate-700/60 bg-slate-900/40 ${sections.activeIncidentsTable ? "" : "lg:col-span-full"}`}
        >
          <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-orange-300" />
              <h2 className="text-lg font-semibold text-white">
                {sections.activeIncidentsTable ? "Recent Guest Reports" : "Guest Reports"}
              </h2>
            </div>
            <Link href={`${venueBase}/reports`} className="text-sm font-semibold text-orange-300 hover:text-orange-200">
              View all reports
            </Link>
          </div>
          {recentGuestReports.length > 0 ? (
            <ul className="divide-y divide-slate-800/70">
              {recentGuestReports.map((incident) => (
                <li key={incident.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <IncidentTypeIcon type={incident.type} />
                    <div>
                      <p className="text-sm font-medium text-slate-100">{incidentTypeLabel(incident.type)}</p>
                      <QrIncidentLocation
                        compact
                        source={incident.source}
                        zoneCode={incident.zoneCode}
                        zoneLabel={incident.zoneLabel}
                        locationName={incident.qrLocationName}
                        rcli={incident.qrRcli}
                      />
                      <p className="mt-1 text-xs text-slate-400">
                        <RelativeTime iso={incident.createdAt} />
                      </p>
                    </div>
                  </div>
                  <IncidentSourceBadge source={incident.source} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-400">No guest reports yet.</p>
          )}
        </section>
      ) : null}

      {sections.staffStatusPanel || sections.cameraHealth ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {sections.staffStatusPanel ? (
            <div className={`rounded-lg border border-slate-700/60 bg-slate-900/40 ${sections.cameraHealth ? "lg:col-span-2" : ""}`}>
              <div className="border-b border-slate-800/80 px-4 py-3">
                <h2 className="text-lg font-semibold text-white">Staff Status</h2>
              </div>
              <ul className="divide-y divide-slate-800/70">
                {FIXTURE_STAFF.map((staff) => (
                  <li key={staff.id} className="px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-100">{staff.name}</p>
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                        <Circle
                          className={`h-2.5 w-2.5 fill-current ${staff.status === "available" ? "text-green-400" : ""} ${staff.status === "responding" ? "text-amber-400" : ""} ${staff.status === "off_duty" ? "text-slate-500" : ""}`}
                        />
                        {staff.status.replace("_", " ")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {staff.currentIncidentId ? `Incident ${staff.currentIncidentId}` : staff.zone ?? "No assignment"}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sections.cameraHealth ? (
            <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Camera className="h-4 w-4 text-orange-300" />
                <h2 className="text-lg font-semibold text-white">Camera Health</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {FIXTURE_CAMERAS.map((camera) => (
                  <div
                    key={camera.id}
                    className="inline-flex min-w-max items-center gap-2 rounded-full border border-slate-700 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-200"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${camera.status === "online" ? "bg-green-400" : ""} ${camera.status === "offline" ? "bg-red-400" : ""} ${camera.status === "degraded" ? "bg-amber-400" : ""}`}
                    />
                    {camera.name}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
