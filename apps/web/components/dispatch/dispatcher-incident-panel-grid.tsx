"use client";

import { useMemo, type ReactNode } from "react";
import type {
  AIAnalysis,
  ConfidenceAnalysis,
  Incident,
  TranscriptSegment,
} from "rapid-cortex-shared";
import { IntelligencePanelContent } from "@/components/dispatch/ai-panel";
import {
  CallerCardLocationPanel,
  CallerCardPremiseNotesPanel,
} from "@/components/dispatch/caller-card-panel";
import { IncidentContextMap } from "@/components/dispatch/incident-context-map";
import { IncidentMediaPanel } from "@/components/dispatch/incident-media-panel";
import { LiveVideoPanel } from "@/components/dispatch/live-video-panel";
import { Ng911AssistPanel } from "@/components/dispatch/ng911-assist-panel";
import { PinpointPanel } from "@/components/dispatch/pinpoint-panel";
import { SilentTextPanel } from "@/components/dispatch/silent-text-panel";
import { TranscriptPanel } from "@/components/dispatch/transcript-panel";
import { VideoAssistPanel } from "@/components/dispatch/video-assist-panel";
import { DispatcherPanelGrid } from "@/components/dispatcher/dispatcher-panel-grid";
import {
  isIncidentMediaEnabled,
  isLiveVideoEnabled,
  isNg911AssistEnabled,
  isPinpointEnabled,
  isSilentTextEnabled,
} from "@/lib/runtime-flags";

function PanelUnavailable({ message }: { message: string }) {
  return <p className="p-3 text-xs text-slate-500">{message}</p>;
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

export function DispatcherIncidentPanelGrid({
  userId,
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
}: {
  userId: string;
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
}) {
  const mapPin = useMemo(() => resolveIncidentMapPin(incident), [incident]);

  const panels = useMemo(() => {
    const callerMobile =
      !incidentId ? (
        <PanelUnavailable message="Select an incident in the queue." />
      ) : isLiveVideoEnabled() ? (
        <LiveVideoPanel incidentId={incidentId} ani={incident?.callerCallback} embedded />
      ) : isIncidentMediaEnabled() ? (
        <IncidentMediaPanel incidentId={incidentId} ani={incident?.callerCallback} embedded />
      ) : (
        <VideoAssistPanel incidentId={incidentId} ani={incident?.callerCallback} />
      );

    return {
      transcript: (
        <div id="cad-transcript" className="flex h-[min(36vh,320px)] min-h-[12rem] flex-col">
          <TranscriptPanel
            segments={transcriptSegments}
            autoScroll={transcriptAutoScroll}
            onAutoScrollChange={onTranscriptAutoScrollChange ?? (() => {})}
            isStreaming={transcriptStreaming}
            isLoading={Boolean(incidentId) && transcriptLoading}
            toolbar={transcriptToolbar}
            className="!min-h-0 !flex-1 !border-r-0 !bg-transparent !border-0"
          />
        </div>
      ),
      map: mapPin ? (
        <div className="p-2">
          <IncidentContextMap
            latitude={mapPin.lat}
            longitude={mapPin.lng}
            label={mapPin.label}
          />
        </div>
      ) : (
        <PanelUnavailable
          message={
            incidentId
              ? "No map coordinates yet — Pinpoint GPS or CAD location will appear here."
              : "Select an incident to load the map."
          }
        />
      ),
      intelligence: (
        <IntelligencePanelContent
          incidentId={incidentId}
          incident={incident}
          analysis={analysis}
          fieldConfidence={fieldConfidence}
          fieldConfidenceLoading={fieldConfidenceLoading}
          analysisError={analysisError}
          analysisLoading={analysisLoading}
          onRefresh={onRefreshAi}
          isRefreshing={isRefreshingAi}
          variant="grid"
        />
      ),
      caller_mobile: callerMobile,
      silent_text: isSilentTextEnabled() ? (
        <SilentTextPanel
          incidentId={incidentId}
          callerLanguage={incident?.callerLanguage}
          ani={incident?.callerCallback}
          embedded
        />
      ) : (
        <PanelUnavailable message="Silent text is not enabled for this agency." />
      ),
      pinpoint: isPinpointEnabled() ? (
        <PinpointPanel incidentId={incidentId} ani={incident?.callerCallback} embedded />
      ) : (
        <PanelUnavailable message="Pinpoint is not enabled for this agency." />
      ),
      location:
        incidentId && showCallerCard ? (
          <CallerCardLocationPanel incidentId={incidentId} />
        ) : (
          <PanelUnavailable message="Caller card / location context is not available." />
        ),
      premise_notes:
        incidentId && showCallerCard ? (
          <CallerCardPremiseNotesPanel incidentId={incidentId} />
        ) : (
          <PanelUnavailable message="Premise notes require caller card access." />
        ),
      ng911_assist: isNg911AssistEnabled() ? (
        <Ng911AssistPanel incidentId={incidentId} />
      ) : (
        <PanelUnavailable message="NG9-1-1 assist is not enabled for this agency." />
      ),
    };
  }, [
    analysis,
    analysisError,
    analysisLoading,
    fieldConfidence,
    fieldConfidenceLoading,
    incident,
    incidentId,
    isRefreshingAi,
    mapPin,
    onRefreshAi,
    onTranscriptAutoScrollChange,
    showCallerCard,
    transcriptAutoScroll,
    transcriptLoading,
    transcriptSegments,
    transcriptStreaming,
    transcriptToolbar,
  ]);

  return <DispatcherPanelGrid userId={userId} panels={panels} className="p-2" />;
}
