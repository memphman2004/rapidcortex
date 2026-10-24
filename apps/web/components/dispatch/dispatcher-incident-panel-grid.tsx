"use client";

import { useMemo, type ReactNode } from "react";
import type {
  AIAnalysis,
  ConfidenceAnalysis,
  Incident,
  TranscriptSegment,
} from "rapid-cortex-shared";
import {
  CallerCardLocationPanel,
  CallerCardPremiseNotesPanel,
} from "@/components/dispatch/caller-card-panel";
import { IncidentContextMap } from "@/components/dispatch/incident-context-map";
import { psapIncidentsToMap } from "@/components/maps/map-incident-adapters";
import { useLiveCallerLocations } from "@/hooks/use-live-caller-locations";
import { IncidentMediaPanel } from "@/components/dispatch/incident-media-panel";
import { IntelligenceWorkstation } from "@/components/dispatch/intelligence-workstation";
import { LiveVideoPanel } from "@/components/dispatch/live-video-panel";
import { PinpointPanel } from "@/components/dispatch/pinpoint-panel";
import { PreArrivalPanel } from "@/components/dispatch/pre-arrival-panel";
import { SilentTextPanel } from "@/components/dispatch/silent-text-panel";
import { TranscriptPanel } from "@/components/dispatch/transcript-panel";
import { VideoAssistPanel } from "@/components/dispatch/video-assist-panel";
import { SectionPopOutButton } from "@/components/dispatch/section-popout-button";
import { CameraAiAlertsPanel } from "@/components/rapid-vision/CameraAiAlertsPanel";
import { WorkstationPanel } from "@/components/dispatch/workstation-panel";
import { ModuleDock, type DockItem } from "@/components/dispatch/module-dock";
import type { DockModuleKey, DockState } from "@/lib/dispatcher/module-dock";
import { visibleDockModules } from "@/lib/dispatcher/section-popout";
import type { WorkstationPanelName } from "@/lib/dispatcher/workstation-prefs";
import {
  isIncidentMediaEnabled,
  isLiveVideoEnabled,
  isPinpointEnabled,
  isPreArrivalIqEnabled,
  isRapidVisionSceneIntelEnabled,
  isSilentTextEnabled,
} from "@/lib/runtime-flags";

function PanelUnavailable({ message }: { message: string }) {
  return <p className="text-[12px] text-[var(--rc-text-muted)]">{message}</p>;
}

function resolveIncidentMapPin(incident: Incident | null): {
  lat: number;
  lng: number;
  label: string;
} | null {
  if (!incident) return null;
  const lat =
    (typeof incident.callerLocationLat === "number" ? incident.callerLocationLat : undefined) ??
    (typeof incident.cadCoordinates?.lat === "number" ? incident.cadCoordinates.lat : undefined);
  const lng =
    (typeof incident.callerLocationLng === "number" ? incident.callerLocationLng : undefined) ??
    (typeof incident.cadCoordinates?.lng === "number" ? incident.cadCoordinates.lng : undefined);
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const label =
    incident.callerLocationMapLabel ||
    incident.callerAddressLine ||
    incident.cadLocation ||
    incident.title ||
    "Incident";
  return { lat, lng, label };
}

export function DispatcherIncidentMapPanel({
  incidentId,
  incident,
}: {
  incidentId: string | null;
  incident: Incident | null;
}) {
  const mapPin = useMemo(() => resolveIncidentMapPin(incident), [incident]);
  const liveCallers = useLiveCallerLocations(incidentId);
  const mapIncidents = useMemo(
    () => (incident && mapPin ? psapIncidentsToMap([incident]) : []),
    [incident, mapPin],
  );
  const center = mapPin ?? (liveCallers[0]
    ? {
        lat: liveCallers[0]!.lat,
        lng: liveCallers[0]!.lng,
        label: liveCallers[0]!.label ?? "Live caller",
      }
    : null);
  if (!center) {
    return (
      <PanelUnavailable
        message={
          incidentId
            ? "No map coordinates yet — Pinpoint GPS or CAD location will appear here."
            : "Select an incident to load the map."
        }
      />
    );
  }
  return (
    <div className="h-full min-h-0 w-full">
      <IncidentContextMap
        latitude={center.lat}
        longitude={center.lng}
        label={center.label}
        liveCallers={liveCallers}
        incidentId={incidentId ?? undefined}
        reportPin={Boolean(mapPin)}
        incidents={mapIncidents}
        fill
      />
    </div>
  );
}

export function DispatcherIncidentWorkstationBody({
  incidentId,
  incident,
  analysis,
  fieldConfidence = null,
  fieldConfidenceLoading = false,
  analysisError = null,
  analysisLoading = false,
  isRefreshingAi = false,
  onRefreshAi,
  showCallerCard = false,
  transcriptSegments = [],
  transcriptToolbar,
  transcriptAutoScroll = true,
  onTranscriptAutoScrollChange,
  transcriptStreaming = false,
  transcriptLoading = false,
  collapsed,
  maximized,
  onToggleCollapse,
  onToggleMaximize,
  languageBar,
  dock,
  onToggleDockSplit,
  onSwapDockSlots,
  onFocusDockSlot,
  onCloseDockSlot,
  soloModule = null,
  onPopOutModule,
}: {
  incidentId: string | null;
  incident: Incident | null;
  analysis: AIAnalysis | null;
  fieldConfidence?: ConfidenceAnalysis | null;
  fieldConfidenceLoading?: boolean;
  analysisError?: string | null;
  analysisLoading?: boolean;
  isRefreshingAi?: boolean;
  onRefreshAi?: () => void;
  showCallerCard?: boolean;
  transcriptSegments?: TranscriptSegment[];
  transcriptToolbar?: ReactNode;
  transcriptAutoScroll?: boolean;
  onTranscriptAutoScrollChange?: (v: boolean) => void;
  transcriptStreaming?: boolean;
  transcriptLoading?: boolean;
  collapsed: Record<WorkstationPanelName, boolean>;
  maximized: WorkstationPanelName | null;
  onToggleCollapse: (name: WorkstationPanelName) => void;
  onToggleMaximize: (name: WorkstationPanelName) => void;
  languageBar?: ReactNode;
  dock: DockState;
  onToggleDockSplit: () => void;
  onSwapDockSlots: () => void;
  onFocusDockSlot: (slot: "left" | "right") => void;
  onCloseDockSlot: (slot: "left" | "right") => void;
  soloModule?: DockModuleKey | null;
  onPopOutModule?: (key: DockModuleKey) => void;
}) {
  const callerMobile =
    !incidentId ? (
      <PanelUnavailable message="Select an incident in the queue." />
    ) : isLiveVideoEnabled() ? (
      <LiveVideoPanel incidentId={incidentId} ani={incident?.callerCallback} embedded />
    ) : isIncidentMediaEnabled() ? (
      <IncidentMediaPanel incidentId={incidentId} ani={incident?.callerCallback} embedded />
    ) : (
      <PanelUnavailable message="Live video and caller media are not enabled for this agency." />
    );

  const videoAssist =
    !incidentId ? (
      <PanelUnavailable message="Select an incident in the queue." />
    ) : (
      <VideoAssistPanel incidentId={incidentId} ani={incident?.callerCallback} />
    );

  const shownCollapsed = soloModule
    ? (new Proxy(collapsed, { get: () => false }) as typeof collapsed)
    : collapsed;

  const modules = visibleDockModules({
    callerCard: showCallerCard,
    liveVideo: isLiveVideoEnabled(),
    incidentMedia: isIncidentMediaEnabled(),
    silentText: isSilentTextEnabled(),
    preArrival: isPreArrivalIqEnabled(),
    pinpoint: isPinpointEnabled(),
    cameraAi: isRapidVisionSceneIntelEnabled(),
  });
  const visibleKeys = new Set(modules.map((item) => item.key));

  const panel = (
    name: WorkstationPanelName,
    title: string,
    body: ReactNode,
    extra?: {
      badge?: string;
      secondary?: boolean;
      className?: string;
      bodyClassName?: string;
      moduleKey?: DockModuleKey;
    },
  ) => (
    <WorkstationPanel
      name={name}
      title={title}
      badge={extra?.badge}
      secondary={extra?.secondary}
      collapsed={shownCollapsed[name]}
      maximized={maximized === name}
      onToggleCollapse={() => onToggleCollapse(name)}
      onToggleMaximize={() => onToggleMaximize(name)}
      onPopOut={
        extra?.moduleKey && onPopOutModule ? () => onPopOutModule(extra.moduleKey as DockModuleKey) : undefined
      }
      className={extra?.className}
      bodyClassName={extra?.bodyClassName}
    >
      {body}
    </WorkstationPanel>
  );

  const items: DockItem[] = [
          {
            key: "transcript",
            label: "Transcript",
            body: (
              <div id="cad-transcript" className="flex h-full min-h-0 flex-col">
                {panel(
                  "transcript",
                  "Transcript",
                  <div className="flex h-full min-h-0 flex-col">
                    {languageBar ? <div className="shrink-0">{languageBar}</div> : null}
                    <TranscriptPanel
                      segments={transcriptSegments}
                      autoScroll={transcriptAutoScroll}
                      onAutoScrollChange={onTranscriptAutoScrollChange ?? (() => {})}
                      isStreaming={transcriptStreaming}
                      isLoading={Boolean(incidentId) && transcriptLoading}
                      toolbar={transcriptToolbar}
                      className="!min-h-0 !flex-1 !border-0 !border-r-0 !bg-transparent"
                    />
                  </div>,
                  { moduleKey: "transcript", bodyClassName: "!p-0 flex flex-col min-h-0" },
                )}
              </div>
            ),
          },
          {
            key: "incident_picture",
            label: "Incident Picture",
            body: (
              <div id="cad-intelligence" className="flex h-full min-h-0 flex-col">
                {panel(
                  "intelligence",
                  "Incident picture",
                  <IntelligenceWorkstation
                    incidentId={incidentId}
                    incident={incident}
                    analysis={analysis}
                    fieldConfidence={fieldConfidence}
                    fieldConfidenceLoading={fieldConfidenceLoading}
                    analysisError={analysisError}
                    analysisLoading={analysisLoading}
                    isRefreshingAi={isRefreshingAi}
                    onRefreshAi={onRefreshAi}
                  />,
                  { moduleKey: "incident_picture", badge: "AI", bodyClassName: "flex min-h-0 flex-col" },
                )}
              </div>
            ),
          },
          { key: "caller_mobile", label: "Caller Mobile", body: panel("caller_mobile", "Caller mobile", callerMobile, { moduleKey: "caller_mobile" }) },
          {
            key: "video_assist",
            label: "Video Assist",
            body: panel("video_assist", "Video Assist (SMS)", videoAssist, { moduleKey: "video_assist" }),
          },
          {
            key: "silent_text",
            label: "Silent Text Link",
            body: panel(
              "silent_text",
              "Silent text link",
              isSilentTextEnabled() ? (
                <SilentTextPanel
                  incidentId={incidentId}
                  callerLanguage={incident?.callerLanguage}
                  ani={incident?.callerCallback}
                  embedded
                />
              ) : (
                <PanelUnavailable message="Silent text is not enabled for this agency." />
              ),
              { moduleKey: "silent_text" },
            ),
          },
          {
            key: "pre_arrival",
            label: "Pre-Arrival iQ",
            body: panel(
              "pre_arrival",
              "Pre-Arrival iQ",
              isPreArrivalIqEnabled() ? (
                <PreArrivalPanel
                  incidentId={incidentId}
                  ani={incident?.callerCallback}
                  cadNatureCode={incident?.cadNatureCode ?? null}
                  embedded
                />
              ) : (
                <PanelUnavailable message="Pre-Arrival iQ is not enabled for this agency." />
              ),
              { moduleKey: "pre_arrival" },
            ),
          },
          {
            key: "pinpoint",
            label: "NexiQ Pinpoint",
            body: panel(
              "pinpoint",
              "NexiQ Pinpoint",
              isPinpointEnabled() ? (
                <PinpointPanel incidentId={incidentId} ani={incident?.callerCallback} embedded />
              ) : (
                <PanelUnavailable message="Pinpoint is not enabled for this agency." />
              ),
              { moduleKey: "pinpoint" },
            ),
          },
          {
            key: "location",
            label: "Location",
            body: panel(
              "location",
              "Location",
              incidentId && showCallerCard ? (
                <CallerCardLocationPanel incidentId={incidentId} />
              ) : (
                <PanelUnavailable message="Caller card / location context is not available." />
              ),
              { moduleKey: "location", secondary: true },
            ),
          },
          {
            key: "premise_notes",
            label: "Premise Notice",
            body: panel(
              "premise_notes",
              "Premise notice",
              incidentId && showCallerCard ? (
                <CallerCardPremiseNotesPanel incidentId={incidentId} />
              ) : (
                <PanelUnavailable message="Premise notice requires caller card access." />
              ),
              { moduleKey: "premise_notes", secondary: true },
            ),
          },
          {
            key: "map",
            label: "Map",
            body: (
              <section className="ws-panel h-full min-h-0 w-full" data-panel="map-module">
                <header className="ws-panel-header">
                  <span className="min-w-0 flex-1 truncate">Map</span>
                  {onPopOutModule ? <SectionPopOutButton label="Map" onClick={() => onPopOutModule("map")} /> : null}
                </header>
                <div className="ws-panel-body flex min-h-0 flex-1 flex-col !overflow-hidden !p-0">
                  <DispatcherIncidentMapPanel incidentId={incidentId} incident={incident} />
                </div>
              </section>
            ),
          },
          {
            key: "camera_ai",
            label: "Camera AI Alerts",
            body: panel(
              "camera_ai",
              "Camera AI alerts",
              isRapidVisionSceneIntelEnabled() ? (
                <CameraAiAlertsPanel />
              ) : (
                <PanelUnavailable message="Camera AI alerts are not enabled." />
              ),
              { moduleKey: "camera_ai", badge: "LIVE", bodyClassName: "!p-0 flex flex-col min-h-0" },
            ),
          },
  ];

  const shown = items.filter((item) => visibleKeys.has(item.key) || item.key === soloModule);

  return (
    <div className="module-dock-host">
      <ModuleDock
        items={shown}
        dock={dock}
        solo={soloModule}
        onToggleSplit={onToggleDockSplit}
        onSwap={onSwapDockSlots}
        onFocusSlot={onFocusDockSlot}
        onCloseSlot={onCloseDockSlot}
        onPopOut={onPopOutModule}
      />
    </div>
  );
}
