"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { postCadWriteback, fetchCadWritebackApprovals } from "@/lib/api";
import { loadIncident } from "@/lib/queries";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";

export type WritebackState =
  | { phase: "idle" }
  | { phase: "preflight" }
  | { phase: "no_cad_link"; reason: string }
  | { phase: "ready" }
  | { phase: "submitting" }
  | { phase: "pending"; approvalId: string; submittedAt: string }
  | { phase: "approved"; approvalId: string; reviewedAt: string; reviewNotes?: string }
  | { phase: "rejected"; approvalId: string; reason: string }
  | { phase: "error"; message: string };

export interface WritebackFormValues {
  narrative: string;
  cadNatureCode?: string;
  priority?: string;
  units?: string;
  internalNotes?: string;
}

export interface UseWritebackOptions {
  incidentId: string;
  incident?: {
    cadIncidentId?: string | null;
    incidentType?: string;
    priority?: string;
    location?: string;
  };
  onSubmitted?: (approvalId: string) => void;
}

export interface UseWritebackReturn {
  state: WritebackState;
  openPreflight: () => Promise<void>;
  close: () => void;
  submit: (values: WritebackFormValues) => Promise<void>;
  retry: () => void;
  enabled: boolean;
}

export function useCadWriteback({
  incidentId,
  incident,
  onSubmitted,
}: UseWritebackOptions): UseWritebackReturn {
  const [state, setState] = useState<WritebackState>({ phase: "idle" });
  const lastValuesRef = useRef<WritebackFormValues | null>(null);
  const enabled = isCadWritebackUiEnabled();

  const openPreflight = useCallback(async () => {
    if (!enabled) return;

    if (incident) {
      if (!incident.cadIncidentId) {
        setState({
          phase: "no_cad_link",
          reason:
            "This incident has no linked CAD event. The read-only CAD adapter must match " +
            "a CAD incident before write-back is available.",
        });
        return;
      }
      setState({ phase: "ready" });
      return;
    }

    setState({ phase: "preflight" });
    try {
      const row = await loadIncident(incidentId);
      if (!row?.cadIncidentId) {
        setState({
          phase: "no_cad_link",
          reason:
            "This incident has no linked CAD event. The read-only CAD adapter must match " +
            "a CAD incident before write-back is available.",
        });
        return;
      }
      setState({ phase: "ready" });
    } catch (e) {
      setState({
        phase: "error",
        message: e instanceof Error ? e.message : "Network error during preflight",
      });
    }
  }, [enabled, incident, incidentId]);

  const close = useCallback(() => {
    setState({ phase: "idle" });
    lastValuesRef.current = null;
  }, []);

  const submit = useCallback(
    async (values: WritebackFormValues) => {
      lastValuesRef.current = values;
      setState({ phase: "submitting" });

      try {
        const units = values.units
          ?.split(",")
          .map((u) => u.trim())
          .filter(Boolean);

        const result = await postCadWriteback(incidentId, {
          narrative: values.narrative.trim(),
          cadNatureCode: values.cadNatureCode?.trim() || undefined,
          priority: values.priority as "P1" | "P2" | "P3" | "P4" | undefined,
          units: units?.length ? units : undefined,
          notes: values.internalNotes?.trim() || undefined,
        });

        if (!result.ok || !result.approvalId) {
          setState({
            phase: "error",
            message: "Write-back queued but no approvalId returned — contact RC ops",
          });
          return;
        }

        const submittedAt = new Date().toISOString();
        setState({ phase: "pending", approvalId: result.approvalId, submittedAt });
        onSubmitted?.(result.approvalId);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Network error — write-back not submitted";
        if (
          message.toLowerCase().includes("cad incident") ||
          message.toLowerCase().includes("counterpart")
        ) {
          setState({
            phase: "no_cad_link",
            reason:
              "CAD incident link was lost between opening and submitting. Refresh the incident and try again.",
          });
          return;
        }
        setState({ phase: "error", message });
      }
    },
    [incidentId, onSubmitted],
  );

  const retry = useCallback(() => {
    if (lastValuesRef.current) {
      void submit(lastValuesRef.current);
    } else {
      setState({ phase: "ready" });
    }
  }, [submit]);

  return { state, openPreflight, close, submit, retry, enabled };
}

export interface UsePendingWritebackCountReturn {
  count: number;
  loading: boolean;
}

/** Polls pending CAD write-back approvals for supervisor nav badge. */
export function usePendingWritebackCount(intervalMs = 30_000): UsePendingWritebackCountReturn {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const enabled = isCadWritebackUiEnabled();

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchCount() {
      try {
        const r = await fetchCadWritebackApprovals({ status: "pending_approval" });
        if (!cancelled) {
          setCount(r.items.length);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchCount();
    const timer = setInterval(() => void fetchCount(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, intervalMs]);

  return { count, loading };
}
