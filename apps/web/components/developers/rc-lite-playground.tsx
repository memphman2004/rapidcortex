"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PlaygroundVariant = {
  endpoint: string;
  method: "GET" | "POST" | "DELETE";
  expectsIdempotency: boolean;
};

const PRESETS: PlaygroundVariant[] = [
  { endpoint: "intelligence/analyze-incident", method: "POST", expectsIdempotency: true },
  { endpoint: "cad/export", method: "POST", expectsIdempotency: true },
  { endpoint: "webhooks/endpoints", method: "GET", expectsIdempotency: false },
];

export function RcLiteApiPlayground() {
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("rk_test_playground");
  const [body, setBody] = useState(
    JSON.stringify(
      {
        agencyCode: "DEMO911",
        scenario: "domestic_disturbance",
        callerTextSnippet: "Neighbor reports screaming.",
      },
      null,
      2,
    ),
  );
  const [responseText, setResponseText] = useState("");
  const [preset, setPreset] = useState(0);

  const active = PRESETS[preset];

  useEffect(() => {
    if (typeof window !== "undefined" && !baseUrl) {
      setBaseUrl(window.location.origin);
    }
  }, [baseUrl]);

  const nextIdempotencyKey = () =>
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `idem_${Math.random().toString(16).slice(2)}`;

  async function invoke() {
    if (!baseUrl.trim()) return;
    let urlSuffix = `/api/v1/${active.endpoint}`;
    if (active.endpoint === "webhooks/endpoints") {
      /** allow manual query params later */
      urlSuffix = `/api/v1/webhooks/endpoints`;
    }
    const target = `${baseUrl.replace(/\/$/, "")}${urlSuffix}`;
    const headers: Record<string, string> = {
      "X-RC-API-Key": apiKey,
    };
    if (active.expectsIdempotency) {
      headers["Idempotency-Key"] = nextIdempotencyKey();
    }
    if (active.method === "POST") {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(target, {
      method: active.method,
      headers,
      body: active.method === "POST" ? body : undefined,
    });
    const text = await res.text();
    const combined = `[${res.status} ${res.statusText}]\nretry-after:${res.headers.get("retry-after") ?? "n/a"}\n\n${text}`;
    setResponseText(combined);
  }

  return (
    <div className="mt-10 space-y-6 rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900/95 to-neutral-950/95 p-6 text-sm text-slate-200 shadow-[0px_55px_120px_rgba(14,165,233,0.12)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-sky-200/85">Sandbox request</p>
          <p className="text-base font-semibold text-white">Interactive API console</p>
        </div>
        <label className="flex flex-col text-xs text-slate-400">
          Base URL (same origin by default)
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="mt-2 w-72 rounded-md border border-white/15 bg-transparent px-3 py-1 text-[13px] text-white outline-none focus:border-sky-400 sm:w-96"
            placeholder="https://localhost:3000"
          />
        </label>
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div className="space-y-3">
          <label className="block text-xs text-slate-400">
            API key preview
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-2 w-full rounded-md border border-white/15 bg-transparent px-3 py-2 text-[13px] text-white outline-none focus:border-sky-400"
            />
          </label>
          <label className="block text-xs text-slate-400">
            Presets
            <select
              className="mt-2 w-full rounded-md border border-white/15 bg-slate-900/95 px-3 py-2 text-[13px] text-white outline-none focus:border-sky-400"
              value={preset}
              onChange={(e) => setPreset(Number.parseInt(e.target.value, 10))}
            >
              {PRESETS.map((presetItem, idx) => (
                <option key={`${presetItem.endpoint}-${presetItem.method}`} value={idx}>
                  {presetItem.method} /{presetItem.endpoint}
                </option>
              ))}
            </select>
          </label>
          {active.method === "POST" ? (
            <label className="block text-xs text-slate-400">
              Body (application/json + Idempotency-Key injected automatically when required)
              <textarea
                className="mt-2 min-h-[200px] w-full rounded-xl border border-white/15 bg-transparent px-3 py-2 font-mono text-[13px] text-white outline-none focus:border-sky-400"
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
          ) : (
            <p className="text-xs text-slate-500">
              GET presets skip Idempotency-Key injection. Sandbox keys cannot exercise production CAD export — keep POST
              payloads focused on intelligence or webhook lab routes.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void invoke()}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-emerald-300 px-10 text-sm font-semibold text-slate-950 shadow-lg shadow-[0_35px_80px_rgba(14,165,233,0.35)] hover:brightness-110"
        >
          Send sandbox request
        </button>
      </div>
      <pre className="max-h-96 overflow-auto rounded-2xl border border-white/10 bg-black/55 p-4 text-xs text-green-300/95">
        {responseText || "Responses appear here..."}
      </pre>
      <p className="text-xs text-slate-500">
        Production credentials are issued under dual-control and hashed before use. Sandbox traffic must never carry real PHI
        / PII.{" "}
        <Link href="/developers/docs/authentication" className="text-sky-400 hover:text-sky-300">
          Authentication & key rotation guidance
        </Link>
      </p>
    </div>
  );
}
