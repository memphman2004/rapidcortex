"use client";

/**
 * Nest integration settings panel — agency admin UI.
 *
 * Renders in Admin → Integrations → Google Nest (and campus/venue cameras).
 * Handles the agency OAuth link flow with projectId + clientId + clientSecret.
 */

import { useCallback, useEffect, useState } from "react";
import { GOOGLE_NEST_TM, NEST_TM } from "@/lib/brand-marks";

type ConnectionStatus = {
  connected: boolean;
  projectId: string | null;
};

type Props = {
  initialProjectId?: string;
};

export function NestIntegrationSettings({ initialProjectId = "" }: Props) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    projectId: initialProjectId,
    clientId: "",
    clientSecret: "",
  });
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cameras/providers/nest/status", { credentials: "include" });
      const json = (await res.json()) as ConnectionStatus & { error?: string };
      setStatus({ connected: Boolean(json.connected), projectId: json.projectId ?? null });
    } catch {
      setStatus({ connected: false, projectId: null });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();

    const params = new URLSearchParams(window.location.search);
    const result = params.get("nest");
    if (result === "connected") {
      setError("");
      void fetchStatus();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (result === "error") {
      setError("Google authorization failed or was cancelled. Please try again.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [fetchStatus]);

  async function handleLink(e: React.FormEvent) {
    e.preventDefault();
    setLinking(true);
    setError("");

    try {
      const res = await fetch("/api/cameras/providers/nest/connect", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: form.projectId.trim(),
          clientId: form.clientId.trim(),
          clientSecret: form.clientSecret.trim(),
        }),
      });

      const json = (await res.json()) as { oauthUrl?: string; error?: string };

      if (!res.ok || !json.oauthUrl) {
        setError(json.error ?? "Failed to initiate connection.");
        setLinking(false);
        return;
      }

      window.location.href = json.oauthUrl;
    } catch {
      setError("Network error. Please try again.");
      setLinking(false);
    }
  }

  async function handleUnlink() {
    if (
      !window.confirm(
        `Disconnect ${GOOGLE_NEST_TM}? Dispatchers will lose access to agency-linked cameras until re-connected.`,
      )
    ) {
      return;
    }
    setUnlinking(true);
    setError("");

    try {
      const res = await fetch("/api/cameras/providers/nest/disconnect", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        setError(json.error ?? "Failed to disconnect.");
      } else {
        setStatus({ connected: false, projectId: null });
        setForm((f) => ({ ...f, clientSecret: "" }));
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUnlinking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-700 border-t-sky-500" />
        Checking {NEST_TM} connection…
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{GOOGLE_NEST_TM}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Agency-linked cameras plus consent-based homeowner sharing
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
            status?.connected
              ? "bg-emerald-950 text-emerald-300"
              : "bg-slate-800 text-slate-500"
          }`}
        >
          {status?.connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {error ? (
        <div className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {status?.connected ? (
        <div className="space-y-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-4 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">Project ID</span>
            <code className="font-mono text-xs text-emerald-300">{status.projectId}</code>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-500">Status</span>
            <span className="text-xs text-emerald-300">OAuth tokens active</span>
          </div>
          <button
            type="button"
            onClick={() => void handleUnlink()}
            disabled={unlinking}
            className="rounded-md border border-red-900/70 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/40 disabled:opacity-60"
          >
            {unlinking ? "Disconnecting…" : `Disconnect ${NEST_TM}`}
          </button>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
            <p className="mb-2 font-semibold text-slate-200">Before connecting</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Create a project at{" "}
                <a
                  href="https://console.nest.google.com/device-access"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300"
                >
                  console.nest.google.com/device-access
                </a>
              </li>
              <li>In Google Cloud Console, create an OAuth 2.0 client (Web application)</li>
              <li>
                Add this redirect URI:{" "}
                <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[11px] text-violet-300">
                  https://api.rapidcortex.us/api/cameras/providers/nest/callback
                </code>
              </li>
              <li>Enter your Project ID, Client ID, and Client Secret below</li>
            </ol>
          </div>

          <form onSubmit={(e) => void handleLink(e)} className="space-y-4">
            <label className="block text-xs text-slate-400">
              Google Device Access Project ID
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                type="text"
                required
                placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
                value={form.projectId}
                onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="block text-xs text-slate-400">
              OAuth Client ID
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                type="text"
                required
                placeholder="…apps.googleusercontent.com"
                value={form.clientId}
                onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
                autoComplete="off"
              />
            </label>
            <label className="block text-xs text-slate-400">
              OAuth Client Secret
              <div className="relative mt-1">
                <input
                  className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 pr-14 text-sm text-slate-100"
                  type={showSecret ? "text" : "password"}
                  required
                  placeholder="GOCSPX-…"
                  value={form.clientSecret}
                  onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500"
                  onClick={() => setShowSecret((v) => !v)}
                  tabIndex={-1}
                >
                  {showSecret ? "Hide" : "Show"}
                </button>
              </div>
              <span className="mt-1 block text-[11px] text-slate-600">
                Encrypted with KMS before storage — never stored in plaintext.
              </span>
            </label>
            <button
              type="submit"
              disabled={linking}
              className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60"
            >
              {linking ? "Redirecting to Google…" : "Connect via Google"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

export { NestIntegrationSettings as CameraProviderSetup };
