"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-context";
import { CameraProviderSetup } from "@/components/cameras/CameraProviderSetup";
import { MilestoneConnectPanel } from "@/components/cameras/MilestoneConnectPanel";
import { NestCameraPanel } from "@/components/cameras/NestCameraPanel";
import { WyzeCameraPanel } from "@/components/cameras/WyzeCameraPanel";
import { GOOGLE_NEST_TM, NEST_TM, WYZE_TM, joinTrademarkList } from "@/lib/brand-marks";
import { isNestEnabled } from "@/lib/nest-feature-flags";
import { isMilestoneXprotectEnabled } from "@/lib/runtime-flags";
import { isWyzeEnabled } from "@/lib/wyze-feature-flags";
import { matchesCampusSiteScope } from "rapid-cortex-shared";
import { CampusSiteSwitcher } from "@/components/campus/campus-site-switcher";
import { useCampusSiteScope } from "@/lib/campus/use-campus-site-scope";

/**
 * Campus dorm / residential cameras — Nest™ + Wyze™ Connect for student-owned
 * doorbells and agency Nest™ accounts, mirrored from venue cameras UX.
 */
export function CampusCamerasClient({ campusCode }: { campusCode: string }) {
  const { user } = useSession();
  const nestEnabled = isNestEnabled();
  const wyzeEnabled = isWyzeEnabled();
  const milestoneEnabled = isMilestoneXprotectEnabled();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const { scope, setScope, sites, primarySiteCode } = useCampusSiteScope(user?.agencyId ?? "");

  useEffect(() => {
    const qp = new URLSearchParams(window.location.search);
    const status = qp.get("status");
    const nest = qp.get("nest");
    if (status === "success" || status === "connected" || nest === "connected") {
      qp.delete("status");
      qp.delete("nest");
      const next = `${window.location.pathname}${qp.toString() ? `?${qp.toString()}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  const incidentsQuery = useQuery({
    queryKey: ["campus-incidents-for-cameras", campusCode],
    enabled: Boolean(user),
    queryFn: async () => {
      const res = await fetch(`/api/campus/incidents?limit=25`, { credentials: "include" });
      if (!res.ok) return [] as Array<{ incidentId: string; title?: string; callerLocationLat?: number; callerLocationLng?: number; siteCode?: string }>;
      const json = (await res.json()) as {
        incidents?: Array<{ incidentId: string; title?: string; callerLocationLat?: number; callerLocationLng?: number; siteCode?: string }>;
        data?: Array<{ incidentId: string; title?: string; callerLocationLat?: number; callerLocationLng?: number; siteCode?: string }>;
      };
      return json.incidents ?? json.data ?? [];
    },
  });

  const incidents = (incidentsQuery.data ?? []).filter((incident) =>
    matchesCampusSiteScope(incident.siteCode, scope, primarySiteCode || campusCode),
  );
  useEffect(() => {
    if (!incidents.length) {
      setSelectedIncidentId(null);
      return;
    }
    if (selectedIncidentId && incidents.some((i) => i.incidentId === selectedIncidentId)) return;
    setSelectedIncidentId(incidents[0]!.incidentId);
  }, [incidents, selectedIncidentId]);

  const selectedIncident = incidents.find((i) => i.incidentId === selectedIncidentId) ?? null;

  if (!user) {
    return <p className="text-sm text-slate-400">Sign in to manage campus cameras.</p>;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cameras</h1>
        <p className="mt-1 text-sm text-slate-400">
          Link dorm{" "}
          {joinTrademarkList([nestEnabled && GOOGLE_NEST_TM, wyzeEnabled && WYZE_TM])}{" "}
          cameras for consent-based live video during campus incidents.
          {nestEnabled ? ` Agency-owned ${NEST_TM} streams are available after admin OAuth.` : ""}
        </p>
        <div className="mt-3 max-w-xs">
          <CampusSiteSwitcher sites={sites} value={scope} onChange={setScope} />
        </div>
      </div>

      <label className="block max-w-md text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Active incident (for nearby dorm search)
        <select
          className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100"
          value={selectedIncidentId ?? ""}
          onChange={(e) => setSelectedIncidentId(e.target.value || null)}
        >
          {incidents.length === 0 ? (
            <option value="">No open incidents</option>
          ) : (
            incidents.map((i) => (
              <option key={i.incidentId} value={i.incidentId}>
                {i.incidentId}
                {i.title ? ` · ${i.title}` : ""}
              </option>
            ))
          )}
        </select>
      </label>

      <div className="grid gap-6 xl:grid-cols-2">
        {milestoneEnabled ? <MilestoneConnectPanel /> : null}
        {nestEnabled ? (
          <section className="space-y-3 rounded-lg border border-emerald-500/30 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-emerald-200">{GOOGLE_NEST_TM} dorm cameras</h2>
            <CameraProviderSetup />
            <NestCameraPanel
              agencyId={user.agencyId}
              incidentId={selectedIncidentId}
              incidentLat={selectedIncident?.callerLocationLat}
              incidentLng={selectedIncident?.callerLocationLng}
              connectSettingsHref={`/app/campus/${campusCode}/cameras`}
            />
          </section>
        ) : null}

        {wyzeEnabled ? (
          <section className="space-y-3 rounded-lg border border-cyan-500/30 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-cyan-200">{WYZE_TM} dorm cameras</h2>
            <WyzeCameraPanel
              agencyId={user.agencyId}
              incidentId={selectedIncidentId}
              incidentLat={selectedIncident?.callerLocationLat}
              incidentLng={selectedIncident?.callerLocationLng}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
