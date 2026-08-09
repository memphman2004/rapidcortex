"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/components/auth/session-context";
import { CadDispatcherWorkspaceLayout } from "@/components/dispatch/cad-dispatcher-workspace-layout";
import {
  CreateIncidentButton,
  type CreateIncidentResult,
} from "@/components/dispatcher/create-incident-slide-over";
import { TranscriptChunkPlayer } from "@/components/dispatch/transcript-chunk-player";
import { AnalyzeIncidentError, isApiConfigured, postTranscriptSegment } from "@/lib/api";
import { isAddonNotEnabledError } from "@/lib/addon-gate-errors";
import { CallerTranslationSection } from "@/components/dispatch/caller-translation-section";
import { isCallerTranslationReplyEnabled } from "@/lib/runtime-flags";
import {
  isCallerCardEnabled,
  isChannelMonitoringEnabled,
  isCrossJurisdictionSharesUiEnabled,
  isFieldConfidenceEnabled,
  isNonEmergencyTriageEnabled,
  isTrainingTranscriptToolbarEnabled,
} from "@/lib/runtime-flags";
import { makeId } from "@/lib/ids";
import {
  loadIncident,
  loadIncidents,
  loadLatestAnalysis,
  loadLatestFieldConfidence,
  loadTranscript,
  runAnalysis,
} from "@/lib/queries";
import type { SimulatedTranscriptChunk } from "@/lib/transcript-sim-stream";
import type { TranscriptSegment } from "rapid-cortex-shared";
import { useJurisdictionSlug } from "@/lib/jurisdiction-context";
import { dispatchDashboardHref } from "@/lib/dispatch-workspace-links";
import { TRAINING_MODE_LABEL, TRAINING_MODE_API_EXPLANATION } from "@/lib/training-mode";

export function DashboardWorkspace() {
  const router = useRouter();
  const jurisdiction = useJurisdictionSlug();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useSession();
  const paramId = searchParams.get("incident");
  const queueParam = searchParams.get("queue");
  const nonEmergencyTriageEnabled = isNonEmergencyTriageEnabled();
  const showDdbQueue = queueParam === "non_emergency" && nonEmergencyTriageEnabled;
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
    if (!list?.length || paramId || showDdbQueue) return;
    const first = list[0]!.incidentId;
    router.replace(
      dispatchDashboardHref(jurisdiction, { incidentId: first }),
    );
  }, [incidentsQuery.data, paramId, router, jurisdiction, showDdbQueue]);

  useEffect(() => {
    if (queueParam === "non_emergency" && nonEmergencyTriageEnabled) {
      setQueueTab("non_emergency");
    } else if (queueParam === "all" || !queueParam) {
      setQueueTab("all");
    }
  }, [queueParam, nonEmergencyTriageEnabled]);

  const handleQueueTabChange = useCallback(
    (tab: "all" | "non_emergency") => {
      setQueueTab(tab);
      if (tab === "non_emergency" && nonEmergencyTriageEnabled) {
        router.replace(
          dispatchDashboardHref(jurisdiction, {
            queue: "non_emergency",
            incidentId: paramId ?? undefined,
          }),
        );
        return;
      }
      if (paramId) {
        router.replace(dispatchDashboardHref(jurisdiction, { incidentId: paramId }));
      } else {
        router.replace(dispatchDashboardHref(jurisdiction));
      }
    },
    [nonEmergencyTriageEnabled, paramId, router, jurisdiction],
  );

  const selectedId = useMemo(() => {
    const list = incidentsQuery.data ?? [];
    if (paramId && list.some((i) => i.incidentId === paramId)) return paramId;
    if (paramId && isCrossJurisdictionSharesUiEnabled()) return paramId;
    return list[0]?.incidentId ?? null;
  }, [paramId, incidentsQuery.data]);

  const setSelectedId = useCallback(
    (id: string) => {
      router.replace(dispatchDashboardHref(jurisdiction, { incidentId: id }));
    },
    [router, jurisdiction],
  );

  const handleIncidentCreated = useCallback(
    async (result: CreateIncidentResult) => {
      await queryClient.invalidateQueries({ queryKey: ["incidents"] });
      setSelectedId(result.incidentId);
    },
    [queryClient, setSelectedId],
  );

  const queueIncidents = incidentsQuery.data ?? [];

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
    refetchInterval: selectedId ? 2_000 : false,
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

  const fieldConfidenceEnabled = isFieldConfidenceEnabled();

  const fieldConfidenceQuery = useQuery({
    queryKey: ["field-confidence", selectedId],
    queryFn: () => (selectedId ? loadLatestFieldConfidence(selectedId) : Promise.resolve(null)),
    enabled: Boolean(selectedId) && fieldConfidenceEnabled,
    staleTime: 2_500,
    refetchInterval: fieldConfidenceEnabled ? 10_000 : false,
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

  const fieldConfidenceForUi = useMemo(() => {
    const row = fieldConfidenceQuery.data;
    if (!row || !selectedId || row.incidentId !== selectedId) return null;
    return row;
  }, [fieldConfidenceQuery.data, selectedId]);

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
      if (fieldConfidenceEnabled) {
        await queryClient.invalidateQueries({ queryKey: ["field-confidence", selectedId] });
      }
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
      if (fieldConfidenceEnabled) {
        await queryClient.invalidateQueries({ queryKey: ["field-confidence", selectedId] });
      }
    } catch (e) {
      if (e instanceof AnalyzeIncidentError) {
        const code = e.body.errorCode ? `${e.body.errorCode}: ` : "";
        setAnalysisError(`${code}${e.message}`);
      } else if (e instanceof Error) {
        setAnalysisError(e.message);
      }
    }
  }, [selectedId, queryClient, fieldConfidenceEnabled]);

  const detailLoading =
    Boolean(selectedId) &&
    (incidentQuery.isLoading ||
      transcriptQuery.isLoading ||
      analysisQuery.isLoading ||
      (fieldConfidenceEnabled && fieldConfidenceQuery.isLoading));

  const analysisBlockedByAddon =
    analysisQuery.isError && isAddonNotEnabledError(analysisQuery.error);

  const loadError =
    incidentsQuery.isError ||
    incidentQuery.isError ||
    transcriptQuery.isError ||
    (analysisQuery.isError && !analysisBlockedByAddon);

  const loadErrorMessage =
    (incidentsQuery.error instanceof Error && incidentsQuery.error.message) ||
    (incidentQuery.error instanceof Error && incidentQuery.error.message) ||
    (transcriptQuery.error instanceof Error && transcriptQuery.error.message) ||
    (analysisQuery.error instanceof Error &&
      !analysisBlockedByAddon &&
      analysisQuery.error.message) ||
    null;

  const showLiveEmptyQueue =
    isApiConfigured() &&
    incidentsQuery.isSuccess &&
    (incidentsQuery.data?.length ?? 0) === 0 &&
    !incidentsQuery.isFetching;

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
            {TRAINING_MODE_API_EXPLANATION}
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
      fieldConfidenceForUi={fieldConfidenceForUi}
      fieldConfidenceLoading={
        fieldConfidenceEnabled &&
        Boolean(selectedId) &&
        (fieldConfidenceQuery.isPending ||
          fieldConfidenceQuery.isFetching ||
          Boolean(fieldConfidenceQuery.data && fieldConfidenceQuery.data.incidentId !== selectedId))
      }
      fieldConfidenceAggregate={fieldConfidenceForUi?.aggregate ?? null}
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
      onQueueTabChange={handleQueueTabChange}
      showNonEmergencyTabs={nonEmergencyTriageEnabled}
      showDdbQueuePanel={showDdbQueue}
      detailLoading={detailLoading}
      selectedIdForPanels={selectedId}
      showCallerCard={isCallerCardEnabled()}
      showChannelMonitor={isChannelMonitoringEnabled()}
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
      languageBar={
        isApiConfigured() && isCallerTranslationReplyEnabled() && selectedId ? (
          <CallerTranslationSection
            incidentId={selectedId}
            incident={incidentForUi}
            segments={transcriptQuery.data ?? []}
          />
        ) : null
      }
      queueEmptyHint={undefined}
      createIncidentAction={
        isApiConfigured() ? (
          <CreateIncidentButton
            userRole={user?.role}
            mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN}
            onCreated={handleIncidentCreated}
          />
        ) : undefined
      }
    />
  );
}
