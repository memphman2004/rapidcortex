"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CadDispatcherWorkspaceLayout } from "@/components/dispatch/cad-dispatcher-workspace-layout";
import { TranscriptChunkPlayer } from "@/components/dispatch/transcript-chunk-player";
import { AnalyzeIncidentError, isApiConfigured, postTranscriptSegment } from "@/lib/api";
import { CallLanguageSelectorBar } from "@/components/dispatch/call-language-selector-bar";
import {
  isCallerCardEnabled,
  isCrossJurisdictionSharesUiEnabled,
  isNonEmergencyTriageEnabled,
  isTrainingTranscriptToolbarEnabled,
} from "@/lib/runtime-flags";
import { makeId } from "@/lib/ids";
import {
  loadIncident,
  loadIncidents,
  loadLatestAnalysis,
  loadTranscript,
  runAnalysis,
} from "@/lib/queries";
import type { SimulatedTranscriptChunk } from "@/lib/transcript-sim-stream";
import type { TranscriptSegment } from "rapid-cortex-shared";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import {
  TRAINING_MODE_LABEL,
  TRAINING_MODE_PUBLIC_API_ENV,
  trainingModeExplanationParts,
} from "@/lib/training-mode";

export function DashboardWorkspace() {
  const router = useRouter();
  const to = useJurisdictionLink();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const paramId = searchParams.get("incident");
  const [autoScroll, setAutoScroll] = useState(true);
  const [isRefreshingAi, setIsRefreshingAi] = useState(false);
  const [simulatedStreamActive, setSimulatedStreamActive] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [queueTab, setQueueTab] = useState<"all" | "non_emergency">("all");

  const incidentsQuery = useQuery({
    queryKey: ["incidents"],
    queryFn: loadIncidents,
  });

  useEffect(() => {
    const list = incidentsQuery.data;
    if (!list?.length || paramId) return;
    const first = list[0]!.incidentId;
    router.replace(
      `${to("/dashboard")}?incident=${encodeURIComponent(first)}`,
    );
  }, [incidentsQuery.data, paramId, router, to]);

  const selectedId = useMemo(() => {
    const list = incidentsQuery.data ?? [];
    if (paramId && list.some((i) => i.incidentId === paramId)) return paramId;
    if (paramId && isCrossJurisdictionSharesUiEnabled()) return paramId;
    return list[0]?.incidentId ?? null;
  }, [paramId, incidentsQuery.data]);

  const setSelectedId = useCallback(
    (id: string) => {
      router.replace(
        `${to("/dashboard")}?incident=${encodeURIComponent(id)}`,
      );
    },
    [router, to],
  );

  const queueIncidents = useMemo(() => {
    const list = incidentsQuery.data ?? [];
    if (!isNonEmergencyTriageEnabled() || queueTab === "all") return list;
    return list.filter((i) => i.urgency === "low" || i.urgency === "moderate");
  }, [incidentsQuery.data, queueTab]);

  useEffect(() => {
    if (!selectedId) return;
    const list = queueIncidents;
    if (!list.length) return;
    if (!list.some((i) => i.incidentId === selectedId)) {
      setSelectedId(list[0]!.incidentId);
    }
  }, [queueIncidents, selectedId, setSelectedId]);

  const incidentQuery = useQuery({
    queryKey: ["incident", selectedId],
    queryFn: () => (selectedId ? loadIncident(selectedId) : Promise.resolve(null)),
    enabled: Boolean(selectedId),
    staleTime: 2_000,
    gcTime: 5 * 60 * 1000,
  });

  const transcriptQuery = useQuery({
    queryKey: ["transcript", selectedId],
    queryFn: () => (selectedId ? loadTranscript(selectedId) : Promise.resolve([])),
    enabled: Boolean(selectedId),
    staleTime: 1_500,
    gcTime: 5 * 60 * 1000,
  });

  const analysisQuery = useQuery({
    queryKey: ["analysis", selectedId],
    queryFn: () => (selectedId ? loadLatestAnalysis(selectedId) : Promise.resolve(null)),
    enabled: Boolean(selectedId),
    /** Always pull the selected incident’s analysis when the queue selection changes. */
    staleTime: 2_500,
    gcTime: 5 * 60 * 1000,
  });

  const incidentForUi = useMemo(() => {
    const row = incidentQuery.data;
    if (!row || !selectedId || row.incidentId !== selectedId) return null;
    return row;
  }, [incidentQuery.data, selectedId]);

  const analysisForUi = useMemo(() => {
    const row = analysisQuery.data;
    if (!row || !selectedId || row.incidentId !== selectedId) return null;
    return row;
  }, [analysisQuery.data, selectedId]);

  useEffect(() => {
    setIsRefreshingAi(false);
    setAnalysisError(null);
  }, [selectedId]);

  const handleRefreshAi = async () => {
    if (!selectedId) return;
    setIsRefreshingAi(true);
    setAnalysisError(null);
    try {
      const next = await runAnalysis(selectedId);
      queryClient.setQueryData(["analysis", selectedId], next);
      await queryClient.invalidateQueries({ queryKey: ["incident", selectedId] });
    } catch (e) {
      if (e instanceof AnalyzeIncidentError) {
        const code = e.body.errorCode ? `${e.body.errorCode}: ` : "";
        const rid = e.body.requestId ? ` (ref ${e.body.requestId})` : "";
        setAnalysisError(`${code}${e.message}${rid}`);
      } else if (e instanceof Error) {
        setAnalysisError(e.message);
      } else {
        setAnalysisError("Analysis request failed.");
      }
    } finally {
      setIsRefreshingAi(false);
    }
  };

  const onStreamState = useCallback(
    (state: { isStreaming: boolean; phase?: import("@/lib/transcript-stream-session").SimulatedTranscriptSessionPhase }) => {
      setSimulatedStreamActive(state.isStreaming);
    },
    [],
  );

  const onSimulatedEmit = useCallback(
    async (chunk: SimulatedTranscriptChunk) => {
      if (!selectedId || !incidentForUi) return;
      const ts = new Date().toISOString();
      if (isApiConfigured()) {
        await postTranscriptSegment(selectedId, {
          speaker: chunk.speaker,
          text: chunk.text,
          timestamp: ts,
        });
        const seg: TranscriptSegment = {
          segmentId: makeId("seg"),
          incidentId: selectedId,
          agencyId: incidentForUi.agencyId,
          speaker: chunk.speaker,
          text: chunk.text,
          timestamp: ts,
        };
        queryClient.setQueryData(
          ["transcript", selectedId],
          (prev: TranscriptSegment[] | undefined) => [...(prev ?? []), seg],
        );
      } else {
        const seg: TranscriptSegment = {
          segmentId: makeId("seg"),
          incidentId: selectedId,
          agencyId: incidentForUi.agencyId,
          speaker: chunk.speaker,
          text: chunk.text,
          timestamp: ts,
        };
        queryClient.setQueryData(
          ["transcript", selectedId],
          (prev: TranscriptSegment[] | undefined) => [...(prev ?? []), seg],
        );
      }
    },
    [incidentForUi, queryClient, selectedId],
  );

  const onSimulatedAnalysis = useCallback(async () => {
    if (!selectedId) return;
    setAnalysisError(null);
    try {
      const next = await runAnalysis(selectedId);
      queryClient.setQueryData(["analysis", selectedId], next);
      await queryClient.invalidateQueries({ queryKey: ["incident", selectedId] });
    } catch (e) {
      if (e instanceof AnalyzeIncidentError) {
        const code = e.body.errorCode ? `${e.body.errorCode}: ` : "";
        setAnalysisError(`${code}${e.message}`);
      } else if (e instanceof Error) {
        setAnalysisError(e.message);
      }
    }
  }, [selectedId, queryClient]);

  const detailLoading =
    Boolean(selectedId) &&
    (incidentQuery.isLoading || transcriptQuery.isLoading || analysisQuery.isLoading);

  const loadError =
    incidentsQuery.isError || incidentQuery.isError || transcriptQuery.isError || analysisQuery.isError;

  const loadErrorMessage =
    (incidentsQuery.error instanceof Error && incidentsQuery.error.message) ||
    (incidentQuery.error instanceof Error && incidentQuery.error.message) ||
    (transcriptQuery.error instanceof Error && transcriptQuery.error.message) ||
    (analysisQuery.error instanceof Error && analysisQuery.error.message) ||
    null;

  const showLiveEmptyQueue =
    isApiConfigured() &&
    incidentsQuery.isSuccess &&
    (incidentsQuery.data?.length ?? 0) === 0 &&
    !incidentsQuery.isFetching;

  const [trainingExplainBefore, trainingExplainAfter] = trainingModeExplanationParts();

  const transcriptToolbar = isTrainingTranscriptToolbarEnabled() ? (
    <TranscriptChunkPlayer
      disabled={
        !selectedId ||
        !incidentForUi ||
        (detailLoading && (transcriptQuery.isLoading || incidentQuery.isLoading))
      }
      resetKey={selectedId}
      onEmit={onSimulatedEmit}
      onAnalysis={onSimulatedAnalysis}
      onStreamState={onStreamState}
    />
  ) : null;

  return (
    <CadDispatcherWorkspaceLayout
      trainingBanner={
        !isApiConfigured() ? (
          <div
            className="shrink-0 border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-100"
            role="status"
          >
            <span className="font-medium">{TRAINING_MODE_LABEL}.</span>{" "}
            {trainingExplainAfter ? (
              <>
                {trainingExplainBefore}
                <code className="rounded bg-black/30 px-1">{TRAINING_MODE_PUBLIC_API_ENV}</code>
                {trainingExplainAfter}
              </>
            ) : (
              trainingExplainBefore
            )}
          </div>
        ) : null
      }
      liveEmptyBanner={
        showLiveEmptyQueue ? (
          <div
            className="shrink-0 border-b border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-300"
            role="status"
          >
            No open incidents for your agency yet. When your workflow creates incidents in Rapid Cortex, they will
            appear here. The <strong>Connections</strong> strip should show API live.
          </div>
        ) : null
      }
      loadErrorBanner={
        loadError ? (
          <div
            className="shrink-0 border-b border-amber-900/50 bg-amber-950/30 px-4 py-2 text-sm text-amber-100"
            role="alert"
          >
            Part of the dashboard failed to load. Check session, API reachability, or permissions. {loadErrorMessage}
          </div>
        ) : null
      }
      incidentForUi={incidentForUi}
      analysisForUi={analysisForUi}
      transcriptSegments={transcriptQuery.data ?? []}
      transcriptToolbar={transcriptToolbar}
      transcriptAutoScroll={autoScroll}
      onTranscriptAutoScrollChange={setAutoScroll}
      transcriptStreaming={simulatedStreamActive}
      transcriptLoading={transcriptQuery.isLoading || incidentQuery.isLoading}
      selectedId={selectedId}
      queueIncidents={queueIncidents}
      incidentsLoading={incidentsQuery.isLoading}
      onSelectIncident={setSelectedId}
      queueTab={queueTab}
      onQueueTabChange={setQueueTab}
      showNonEmergencyTabs={isNonEmergencyTriageEnabled()}
      detailLoading={detailLoading}
      selectedIdForPanels={selectedId}
      showCallerCard={isCallerCardEnabled()}
      showSharePanel={isCrossJurisdictionSharesUiEnabled() && Boolean(incidentForUi)}
      shareOwnerAgencyId={incidentForUi?.agencyId}
      analysisError={analysisError}
      analysisLoading={
        Boolean(selectedId) &&
        (analysisQuery.isPending ||
          analysisQuery.isFetching ||
          Boolean(analysisQuery.data && analysisQuery.data.incidentId !== selectedId))
      }
      isRefreshingAi={isRefreshingAi}
      onRefreshAi={selectedId ? handleRefreshAi : undefined}
      languageBar={isApiConfigured() ? <CallLanguageSelectorBar /> : null}
      queueEmptyHint={
        isNonEmergencyTriageEnabled() && queueTab === "non_emergency" && (incidentsQuery.data?.length ?? 0) > 0
          ? "No incidents match the non-emergency filter (low / moderate urgency) right now."
          : undefined
      }
    />
  );
}
