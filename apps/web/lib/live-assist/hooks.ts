"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  LiveAssistSession,
  LiveAssistDevice,
  LiveAssistEvent,
  BodyCameraManufacturer,
  LiveAssistProvider,
  LiveAssistCoachingTokenResponse,
} from "rapid-cortex-shared";

// ─── Shared fetch ─────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Provider catalog ─────────────────────────────────────────────────────────

export interface ProviderCatalogEntry {
  manufacturer: BodyCameraManufacturer;
  displayName: string;
  integrationStatus: string;
  pendingVendorAuthorization: boolean;
  documentationUrl: string | null;
  defaultCapabilities: Record<string, unknown>;
  providerId: string | null;
  lastValidatedAt: string | null;
  lastError: string | null;
}

export function useProviders() {
  return useQuery<{ providers: ProviderCatalogEntry[] }>({
    queryKey: ["live-assist", "providers"],
    queryFn: () => apiFetch("/api/live-assist/providers"),
    staleTime: 30_000,
  });
}

export function useValidateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (providerId: string) =>
      apiFetch(`/api/live-assist/providers/${providerId}/validate`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["live-assist", "providers"] }),
  });
}

// ─── Devices ──────────────────────────────────────────────────────────────────

export function useDevices() {
  return useQuery<{ devices: LiveAssistDevice[] }>({
    queryKey: ["live-assist", "devices"],
    queryFn: () => apiFetch("/api/live-assist/devices"),
    staleTime: 15_000,
  });
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function useSessions() {
  return useQuery<{ sessions: LiveAssistSession[] }>({
    queryKey: ["live-assist", "sessions"],
    queryFn: () => apiFetch("/api/live-assist/sessions"),
    refetchInterval: 10_000,
  });
}

export function useSession(sessionId: string | null) {
  return useQuery<{ session: LiveAssistSession }>({
    queryKey: ["live-assist", "sessions", sessionId],
    queryFn: () => apiFetch(`/api/live-assist/sessions/${sessionId}`),
    enabled: !!sessionId,
    refetchInterval: 5_000,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { deviceId: string; incidentId?: string; officerId?: string }) =>
      apiFetch<{ session: LiveAssistSession }>("/api/live-assist/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["live-assist", "sessions"] }),
  });
}

export function useStartStream() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch<{ session: LiveAssistSession; started: boolean; pendingVendorAuthorization?: boolean }>(
        `/api/live-assist/sessions/${sessionId}/stream`,
        { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
      ),
    onSuccess: (_, sessionId) =>
      void qc.invalidateQueries({ queryKey: ["live-assist", "sessions", sessionId] }),
  });
}

export function useRequestCoaching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      officerEndpointRef,
      transportType = "webrtc",
    }: {
      sessionId: string;
      officerEndpointRef?: string;
      transportType?: "webrtc" | "mobile_app";
    }) =>
      apiFetch(`/api/live-assist/sessions/${sessionId}/coaching/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ officerEndpointRef, transportType }),
      }),
    onSuccess: (_, { sessionId }) =>
      void qc.invalidateQueries({ queryKey: ["live-assist", "sessions", sessionId] }),
  });
}

export function useTerminateCoaching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/api/live-assist/sessions/${sessionId}/coaching/terminate`, { method: "POST" }),
    onSuccess: (_, sessionId) =>
      void qc.invalidateQueries({ queryKey: ["live-assist", "sessions", sessionId] }),
  });
}

export function useEndSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiFetch(`/api/live-assist/sessions/${sessionId}/end`, { method: "POST" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["live-assist", "sessions"] }),
  });
}

// ─── Events ───────────────────────────────────────────────────────────────────

export function useSessionEvents(sessionId: string | null) {
  return useQuery<{ events: LiveAssistEvent[] }>({
    queryKey: ["live-assist", "events", sessionId],
    queryFn: () => apiFetch(`/api/live-assist/sessions/${sessionId}/events?limit=50`),
    enabled: !!sessionId,
    refetchInterval: 8_000,
  });
}

// ─── Coaching WebRTC token ────────────────────────────────────────────────────

/**
 * Fetches KVS signaling credentials for the coaching channel.
 * role="master" = supervisor side (sends audio to officer)
 * role="viewer" = officer side (receives audio from supervisor)
 *
 * Token is only requested when the coaching channel is active and the caller
 * is authorised (the API enforces canCoachLiveAssist for master).
 */
export function useCoachingToken(
  sessionId: string | null,
  role: "master" | "viewer",
  enabled = true,
) {
  return useQuery<LiveAssistCoachingTokenResponse>({
    queryKey: ["live-assist", "coaching-token", sessionId, role],
    queryFn: () =>
      apiFetch(`/api/live-assist/sessions/${sessionId}/coaching/token?role=${role}`),
    enabled: !!sessionId && enabled,
    // Tokens expire in 15 min; refresh 2 min before expiry
    staleTime: 13 * 60 * 1000,
    gcTime:    15 * 60 * 1000,
    retry: 2,
  });
}

// ─── Coaching PTT event sender ────────────────────────────────────────────────

/** Tells the backend the supervisor started/stopped speaking (fires WS push to officer). */
export function usePtt(sessionId: string | null) {
  return useMutation({
    mutationFn: (active: boolean) =>
      apiFetch(`/api/live-assist/sessions/${sessionId}/coaching/ptt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      }),
  });
}
