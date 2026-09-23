"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { MilestoneStatus, MilestoneSyncResult } from "rapid-cortex-shared";
import { isMilestoneXprotectEnabled } from "@/lib/runtime-flags";

async function readJson<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json;
}

/**
 * Campus admin panel — connect on-prem Milestone Bridge and sync XProtect cameras
 * into the campus camera registry (vendor=milestone).
 */
export function MilestoneConnectPanel() {
  const enabled = isMilestoneXprotectEnabled();
  const queryClient = useQueryClient();
  const [bridgeBaseUrl, setBridgeBaseUrl] = useState("");
  const [siteLabel, setSiteLabel] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ["milestone-status"],
    enabled,
    queryFn: async () => {
      const res = await fetch("/api/milestone/status", { credentials: "include" });
      return readJson<MilestoneStatus>(res);
    },
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/milestone/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bridgeBaseUrl: bridgeBaseUrl.trim(),
          siteLabel: siteLabel.trim() || undefined,
          outboundEnabled: true,
        }),
      });
      return readJson<MilestoneStatus>(res);
    },
    onSuccess: async () => {
      setMessage("Milestone Bridge connected.");
      await queryClient.invalidateQueries({ queryKey: ["milestone-status"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/milestone/disconnect", {
        method: "DELETE",
        credentials: "include",
      });
      return readJson<{ disconnected: boolean }>(res);
    },
    onSuccess: async () => {
      setMessage("Milestone disconnected.");
      await queryClient.invalidateQueries({ queryKey: ["milestone-status"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/milestone/cameras/sync", {
        method: "POST",
        credentials: "include",
      });
      return readJson<MilestoneSyncResult>(res);
    },
    onSuccess: async (data) => {
      setMessage(`Synced ${data.synced} XProtect camera${data.synced === 1 ? "" : "s"}.`);
      await queryClient.invalidateQueries({ queryKey: ["milestone-status"] });
    },
    onError: (err: Error) => setMessage(err.message),
  });

  if (!enabled) return null;

  const status = statusQuery.data;

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
      <h2 className="text-lg font-semibold text-white">Milestone XProtect</h2>
      <p className="mt-1 text-sm text-slate-400">
        Connect the on-prem Rapid Cortex Milestone Bridge. Cloud never calls XProtect directly —
        the bridge uses MIP SDK / XProtect REST on campus.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-slate-300">
          Bridge base URL
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            placeholder="https://bridge.campus.example:8443"
            value={bridgeBaseUrl}
            onChange={(e) => setBridgeBaseUrl(e.target.value)}
          />
        </label>
        <label className="block text-sm text-slate-300">
          Site label (optional)
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            placeholder="IU Bloomington XProtect"
            value={siteLabel}
            onChange={(e) => setSiteLabel(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
          disabled={!bridgeBaseUrl.trim() || connectMutation.isPending}
          onClick={() => connectMutation.mutate()}
        >
          Connect
        </button>
        <button
          type="button"
          className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          disabled={!status?.connected || syncMutation.isPending}
          onClick={() => syncMutation.mutate()}
        >
          Sync cameras
        </button>
        <button
          type="button"
          className="rounded border border-rose-800 px-3 py-2 text-sm text-rose-300 hover:bg-rose-950 disabled:opacity-50"
          disabled={!status?.connected || disconnectMutation.isPending}
          onClick={() => disconnectMutation.mutate()}
        >
          Disconnect
        </button>
      </div>

      <dl className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Status</dt>
          <dd>{statusQuery.isLoading ? "Loading…" : status?.connected ? "Connected" : "Not connected"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Last sync</dt>
          <dd>{status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Cameras</dt>
          <dd>{status?.cameraCount ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Mode</dt>
          <dd>{status?.mock ? "Mock bridge" : status?.connected ? "Live bridge" : "—"}</dd>
        </div>
      </dl>

      {message ? <p className="mt-3 text-sm text-sky-300">{message}</p> : null}
    </section>
  );
}
