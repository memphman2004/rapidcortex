"use client";

import { useMemo } from "react";
import type { Incident, TranscriptSegment } from "rapid-cortex-shared";
import { IncidentContextMap } from "@/components/dispatch/incident-context-map";
import { LiveVideoPanel } from "@/components/dispatch/live-video-panel";
import { TranscriptPanel } from "@/components/dispatch/transcript-panel";
import { useLiveCallerLocations } from "@/hooks/use-live-caller-locations";
import { useAIEnabled } from "@/lib/ai-gate/context";
import { isIncidentIntelligenceEnabled, isLiveVideoEnabled } from "@/lib/runtime-flags";

function durationLabel(createdAt: string | undefined): string {
  if (!createdAt) return "—";
  const ms = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Live Incident Intelligence — 2×2 grid mounted below the context map, above notes.
 * Feature-flagged; video quadrant locked when agency AI is unauthorized.
 */
export function IncidentIntelligencePanel({
  incidentId,
  incident,
  transcriptSegments = [],
}: {
  incidentId: string | null;
  incident: Incident | null;
  transcriptSegments?: TranscriptSegment[];
}) {
  const aiEnabled = useAIEnabled();
  const liveCallers = useLiveCallerLocations(incidentId);
  const mapCenter = useMemo(() => {
    const lat =
      (typeof incident?.callerLocationLat === "number" ? incident.callerLocationLat : undefined) ??
      incident?.cadCoordinates?.lat ??
      liveCallers[0]?.lat;
    const lng =
      (typeof incident?.callerLocationLng === "number" ? incident.callerLocationLng : undefined) ??
      incident?.cadCoordinates?.lng ??
      liveCallers[0]?.lng;
    if (lat == null || lng == null) return null;
    return { lat, lng };
  }, [incident, liveCallers]);

  if (!isIncidentIntelligenceEnabled()) return null;
  if (!incidentId) {
    return (
      <section className="border-b border-[var(--rc-border)] bg-[var(--rc-panel-bg)] p-2 text-[11px] text-[var(--rc-text-muted)]">
        Select an incident for Live Incident Intelligence.
      </section>
    );
  }

  const units =
    incident?.cadUnitDetails?.length
      ? incident.cadUnitDetails
      : (incident?.cadUnits ?? []).map((id) => ({ unitId: id, callSign: id }));

  return (
    <section
      className="shrink-0 border-b border-[var(--rc-border)] bg-[var(--rc-panel-bg)] p-2"
      aria-label="Live Incident Intelligence"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--rc-text)]">
          Live Incident Intelligence
        </h3>
        <span className="text-[10px] text-[var(--rc-text-muted)]">2×2</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="min-h-[120px] overflow-hidden rounded border border-[var(--rc-border)] bg-[#0b1118]">
          <p className="border-b border-[var(--rc-border)] px-2 py-1 text-[10px] uppercase text-slate-500">
            Live transcript
          </p>
          <div className="h-[110px] overflow-hidden">
            <TranscriptPanel
              segments={transcriptSegments}
              autoScroll
              onAutoScrollChange={() => {}}
              isStreaming={false}
              isLoading={false}
              className="!min-h-0 !h-full !border-0 !bg-transparent text-[11px]"
            />
          </div>
        </div>

        <div className="min-h-[120px] overflow-hidden rounded border border-[var(--rc-border)] bg-[#0b1118]">
          <p className="border-b border-[var(--rc-border)] px-2 py-1 text-[10px] uppercase text-slate-500">
            Caller video
          </p>
          {!aiEnabled ? (
            <div className="flex h-[110px] items-center justify-center px-3 text-center text-[11px] text-amber-200/90">
              AI features are not authorized for this agency. Video locked.
            </div>
          ) : isLiveVideoEnabled() ? (
            <div className="h-[110px]">
              <LiveVideoPanel incidentId={incidentId} ani={incident?.callerCallback} embedded />
            </div>
          ) : (
            <div className="flex h-[110px] items-center justify-center text-[11px] text-slate-500">
              Live video disabled
            </div>
          )}
        </div>

        <div className="min-h-[120px] overflow-hidden rounded border border-[var(--rc-border)] bg-[#0b1118]">
          <p className="border-b border-[var(--rc-border)] px-2 py-1 text-[10px] uppercase text-slate-500">
            Compact map
          </p>
          {mapCenter ? (
            <IncidentContextMap
              latitude={mapCenter.lat}
              longitude={mapCenter.lng}
              label={incident?.cadLocation ?? incident?.title ?? "Incident"}
              liveCallers={liveCallers}
              incidentId={incidentId}
              fill={false}
            />
          ) : (
            <div className="flex h-[110px] items-center justify-center text-[11px] text-slate-500">
              No coordinates yet
            </div>
          )}
        </div>

        <div className="min-h-[120px] overflow-hidden rounded border border-[var(--rc-border)] bg-[#0b1118] p-2 text-[11px] text-slate-200">
          <p className="mb-1 text-[10px] uppercase text-slate-500">CAD summary</p>
          <dl className="space-y-0.5">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Type</dt>
              <dd className="truncate font-medium">
                {incident?.cadNatureCode ?? incident?.category ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Priority</dt>
              <dd className="font-medium">{incident?.cadPriority ?? incident?.urgency ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Address</dt>
              <dd className="truncate text-right">
                {incident?.cadLocation ?? incident?.callerAddressLine ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Units</dt>
              <dd className="truncate text-right">
                {units.length
                  ? units
                      .map((u) => ("callSign" in u && u.callSign ? u.callSign : u.unitId) ?? "?")
                      .join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Duration</dt>
              <dd>{durationLabel(incident?.createdAt)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
