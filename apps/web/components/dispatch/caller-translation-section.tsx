"use client";

import { useEffect, useMemo, useState } from "react";
import type { Incident, TranscriptSegment } from "rapid-cortex-shared";
import {
  inferCallerLanguageFromSegments,
  resolveIncidentCallerLanguage,
} from "@/lib/dispatch/caller-language";
import { CallerLanguageBar } from "@/components/dispatch/caller-language-bar";
import { DispatcherCallerReplyPanel } from "@/components/dispatch/dispatcher-caller-reply-panel";

/**
 * Owns the dispatcher-selected caller language so the language bar and English→caller
 * reply panel stay in sync (including before the incident PATCH round-trips).
 */
export function CallerTranslationSection({
  incidentId,
  incident,
  segments,
}: {
  incidentId: string | null;
  incident: Incident | null;
  segments: TranscriptSegment[];
}) {
  const inferred = useMemo(() => inferCallerLanguageFromSegments(segments), [segments]);
  const resolved = useMemo(
    () => resolveIncidentCallerLanguage(incident, segments),
    [incident, segments],
  );
  const [selectedLanguage, setSelectedLanguage] = useState(resolved ?? inferred ?? "es");

  useEffect(() => {
    if (resolved) setSelectedLanguage(resolved);
    else if (inferred) setSelectedLanguage(inferred);
  }, [resolved, inferred]);

  return (
    <>
      <CallerLanguageBar
        incidentId={incidentId}
        incident={incident}
        segments={segments}
        selectedLanguage={selectedLanguage}
        onSelectedLanguageChange={setSelectedLanguage}
      />
      <DispatcherCallerReplyPanel
        incidentId={incidentId}
        incident={incident}
        segments={segments}
        selectedLanguage={selectedLanguage}
      />
    </>
  );
}
