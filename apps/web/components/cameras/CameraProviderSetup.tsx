"use client";

import { useState } from "react";
import { GOOGLE_NEST_TM, NEST_TM } from "@/lib/brand-marks";

type ProviderField = {
  key: string;
  label: string;
  type: "text";
  placeholder: string;
};

const PROVIDERS: Record<
  string,
  {
    label: string;
    description: string;
    fields: ProviderField[];
    connectPath: string;
  }
> = {
  nest: {
    label: GOOGLE_NEST_TM,
    description: `Connect ${NEST_TM} cameras via Google SDM OAuth (client secret stored in AWS Secrets Manager).`,
    connectPath: "/api/cameras/providers/nest/connect",
    fields: [
      {
        key: "projectId",
        label: "GCP Project ID",
        type: "text",
        placeholder: "rapidcortex-prod",
      },
      {
        key: "clientId",
        label: "OAuth 2.0 Client ID",
        type: "text",
        placeholder: "699422835395-h6vgb0faql5rod3v0h08ahj2penabjl9.apps.googleusercontent.com",
      },
    ],
  },
};

export function CameraProviderSetup() {
  const [providerId, setProviderId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = providerId ? PROVIDERS[providerId] : null;

  async function handleConnect(id: string) {
    setProviderId(id);
    setValues({});
    setError(null);
  }

  async function handleSubmit() {
    if (!provider) return;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, string> = {};
      for (const field of provider.fields) {
        const v = values[field.key]?.trim() ?? "";
        if (!v) {
          throw new Error(`${field.label} is required`);
        }
        payload[field.key] = v;
      }

      const res = await fetch(provider.connectPath, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as { oauthUrl?: string; error?: string };
      if (!res.ok || !data.oauthUrl) {
        throw new Error(data.error ?? `Connect failed (${res.status})`);
      }

      window.location.href = data.oauthUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Camera providers</h2>
        <p className="mt-1 text-sm text-slate-400">
          Link third-party camera accounts for venue and connect workflows.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(PROVIDERS).map(([id, cfg]) => (
          <article
            key={id}
            className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4"
          >
            <h3 className="font-semibold text-slate-100">{cfg.label}</h3>
            <p className="mt-1 text-xs text-slate-500">{cfg.description}</p>
            <button
              type="button"
              onClick={() => handleConnect(id)}
              className="mt-4 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-500"
            >
              Connect
            </button>
          </article>
        ))}
      </div>

      {provider ? (
        <div className="rounded-lg border border-slate-700/60 bg-slate-950/60 p-4">
          <h3 className="text-sm font-semibold text-slate-200">Connect {provider.label}</h3>
          <div className="mt-3 space-y-3">
            {provider.fields.map((field) => (
              <label key={field.key} className="block text-xs text-slate-400">
                {field.label}
                <input
                  type={field.type}
                  value={values[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </label>
            ))}
          </div>
          {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setProviderId(null)}
              disabled={loading}
              className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Redirecting…" : "Authorize with Google"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
