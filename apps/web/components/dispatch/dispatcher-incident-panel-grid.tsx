"use client";

import { useMemo } from "react";
import type { AIAnalysis, ConfidenceAnalysis, Incident } from "rapid-cortex-shared";
import { IntelligencePanelContent } from "@/components/dispatch/ai-panel";
import {
  CallerCardLocationPanel,
  CallerCardPremiseNotesPanel,
} from "@/components/dispatch/caller-card-panel";
import { IncidentMediaPanel } from "@/components/dispatch/incident-media-panel";
import { LiveVideoPanel } from "@/components/dispatch/live-video-panel";
import { PinpointPanel } from "@/components/dispatch/pinpoint-panel";
import { SilentTextPanel } from "@/components/dispatch/silent-text-panel";
import { VideoAssistPanel } from "@/components/dispatch/video-assist-panel";
import { DispatcherPanelGrid } from "@/components/dispatcher/dispatcher-panel-grid";
import { Ng911AssistPanel } from "@/components/dispatch/ng911-assist-panel";
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
}) {
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
    onRefreshAi,
    showCallerCard,
  ]);

  if (!incidentId) {
    return (
      <div className="p-3 font-mono text-xs text-slate-500">Select an incident to load incident panels.</div>
    );
  }

  return <DispatcherPanelGrid userId={userId} panels={panels} className="p-2" />;
}
