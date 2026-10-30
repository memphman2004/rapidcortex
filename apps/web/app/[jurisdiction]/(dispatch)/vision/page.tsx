"use client";

import { Suspense, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/auth/session-context";
import {
  VisionCommandCenter,
  type VisionSection,
} from "@/components/rapid-vision/VisionCommandCenter";
import { loadIncidents } from "@/lib/queries";
import { isSceneAlertWatchDesk } from "@/lib/rapid-vision/scene-alert-audience";
import { isRapidVisionEnabled } from "@/lib/runtime-flags";

const SECTIONS = new Set<VisionSection>([
  "command",
  "scene",
  "cameras",
  "alerts",
  "incident",
  "analytics",
  "settings",
]);

function canVerifyRapidVision(role: string | undefined): boolean {
  const normalized = (role ?? "").toLowerCase();
  return (
    normalized === "dispatcher" ||
    normalized === "supervisor" ||
    normalized === "agencyadmin" ||
    normalized === "command"
  );
}

function DispatcherVisionPageInner() {
  const { user } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const rapidVisionEnabled = isRapidVisionEnabled();
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);

  const incidentsQuery = useQuery({
    queryKey: ["incidents", "vision-page"],
    queryFn: loadIncidents,
  });
  const incidents = useMemo(() => incidentsQuery.data ?? [], [incidentsQuery.data]);
  const queryIncident =
    searchParams?.get("incident")?.trim() || searchParams?.get("incidentId")?.trim() || null;
  const incidentId =
    selectedIncidentId ??
    (queryIncident && incidents.some((incident) => incident.incidentId === queryIncident) ? queryIncident : null);

  const requested = searchParams?.get("tab")?.trim() ?? "";
  const section: VisionSection = SECTIONS.has(requested as VisionSection)
    ? (requested as VisionSection)
    : queryIncident
      ? "incident"
      : "command";

  if (!rapidVisionEnabled) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-sm text-slate-300">
          iQ Vision is currently disabled for this environment.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#070b14] p-4">
      <VisionCommandCenter
        section={section}
        onSection={(next) => {
          const params = new URLSearchParams(searchParams?.toString() ?? "");
          params.set("tab", next);
          router.replace(`?${params.toString()}`);
        }}
        focusAlertId={searchParams?.get("alert")?.trim() || null}
        agencyName={user?.agencyId?.trim() || "This agency"}
        incidents={incidents}
        selectedIncidentId={incidentId}
        onSelectIncident={setSelectedIncidentId}
        canVerify={canVerifyRapidVision(user?.role)}
        reviewQueue={isSceneAlertWatchDesk(user?.role)}
      />
    </div>
  );
}

export default function DispatcherVisionPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-slate-400">Loading iQ Vision…</div>}>
      <DispatcherVisionPageInner />
    </Suspense>
  );
}
