"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isApiConfigured } from "@/lib/api";

type CapabilityBlock = {
  translation: boolean;
  speechToText: boolean;
  textToSpeech: boolean;
  realTimeVoice: boolean;
  callerSms: boolean;
  dispatcherUi: boolean;
};

export type CallIntelligenceLanguageRow = {
  code: string;
  name: string;
  nativeName?: string;
  direction?: "ltr" | "rtl";
  emergencyPriority?: string;
  capabilities: CapabilityBlock;
  providers?: { translation?: string[] };
};

type LanguagesResponse = {
  ok: boolean;
  primaryProvider?: string;
  fallbackProvider?: string;
  count?: number;
  languages?: CallIntelligenceLanguageRow[];
  warnings?: string[];
};

function tierRank(p?: string): number {
  if (p === "core") return 0;
  if (p === "high") return 1;
  return 2;
}

function describeLanguagesFetchError(status: number, bodyText: string): string {
  let parsed: Record<string, unknown> | null = null;
  try {
    const j = JSON.parse(bodyText) as unknown;
    if (j && typeof j === "object") parsed = j as Record<string, unknown>;
  } catch {
    /* plain text */
  }
  const err = typeof parsed?.error === "string" ? parsed.error : null;
  const message = typeof parsed?.message === "string" ? parsed.message : null;
  const hint = typeof parsed?.hint === "string" ? parsed.hint : null;

  if (status === 401) {
    return "Sign in again — session may have expired.";
  }
  if (status === 403) {
    return (
      message ??
      "Live translation is not enabled for this agency (add-on or plan). Contact your administrator."
    );
  }
  if (status === 503) {
    return hint ?? message ?? err ?? bodyText.slice(0, 200) ?? "Upstream API not configured or unavailable.";
  }
  if (status === 500 && err === "language_support_unavailable") {
    return "Language service failed on the API (check stack-2 deploy and CloudWatch logs).";
  }
  return message ?? err ?? (bodyText.slice(0, 200) || `Request failed (${status})`);
}

export function CallLanguageSelectorBar() {
  const params = useSearchParams();
  const debugProviders = params.get("debug") === "languages";
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["call-intelligence-languages"],
    queryFn: async (): Promise<LanguagesResponse> => {
      const res = await fetch("/api/call-intelligence/languages", { credentials: "same-origin" });
      if (!res.ok) {
        const bodyText = await res.text();
        throw new Error(describeLanguagesFetchError(res.status, bodyText));
      }
      return res.json();
    },
    enabled: typeof window !== "undefined" && isApiConfigured(),
  });

  const rows = useMemo(() => {
    const list = query.data?.languages ?? [];
    const qq = q.trim().toLowerCase();
    let filtered = !qq
      ? list
      : list.filter((l) => {
          const hay = `${l.code} ${l.name} ${l.nativeName ?? ""}`.toLowerCase();
          return hay.includes(qq);
        });
    filtered = [...filtered].sort((a, b) => {
      const preferred = ["en", "es"];
      const ap = preferred.indexOf(a.code);
      const bp = preferred.indexOf(b.code);
      if (ap !== -1 || bp !== -1) return (ap === -1 ? 99 : ap) - (bp === -1 ? 99 : bp);
      const tr = tierRank(a.emergencyPriority) - tierRank(b.emergencyPriority);
      if (tr !== 0) return tr;
      return a.name.localeCompare(b.name);
    });
    return filtered.slice(0, debugProviders ? 400 : 40);
  }, [debugProviders, q, query.data?.languages]);

  if (!isApiConfigured()) return null;

  return (
    <div className="shrink-0 border-b border-slate-800 bg-slate-950/60 px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Call translation</h3>
          <p className="text-[11px] text-slate-500">
            Languages with text translation capability (speech features are tracked separately).
          </p>
        </div>
        <input
          aria-label="Search languages"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, native name, or code…"
          className="min-w-[12rem] flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[11px] text-slate-100 placeholder:text-slate-600"
        />
      </div>
      {query.isLoading ? (
        <p className="mt-2 text-[11px] text-slate-500">Loading language directory…</p>
      ) : query.isError ? (
        <p className="mt-2 text-[11px] text-rose-400">
          Could not load languages.{" "}
          {query.error instanceof Error ? query.error.message : "Check auth, API_UPSTREAM_BASE_2, and entitlements."}
        </p>
      ) : (
        <ul className="mt-2 max-h-44 overflow-auto text-[11px] text-slate-200">
          {rows.map((l) => (
            <li key={l.code} className="flex flex-wrap items-center gap-2 border-b border-slate-800/70 py-1.5">
              <span className="font-mono text-sky-400">{l.code}</span>
              <span>{l.name}</span>
              {l.nativeName ? <span className="text-slate-400">{l.nativeName}</span> : null}
              {l.direction === "rtl" ? (
                <span className="rounded bg-amber-900/40 px-1 py-px text-[9px] font-semibold uppercase text-amber-100">
                  RTL
                </span>
              ) : null}
              {l.capabilities.translation ? (
                <span className="rounded bg-slate-800 px-1 py-px text-[9px] font-semibold uppercase text-slate-200">
                  Text translation
                </span>
              ) : null}
              {debugProviders && (l.providers?.translation?.length ?? 0) > 0 ? (
                <span className="rounded bg-emerald-900/40 px-1 py-px font-mono text-[9px] text-emerald-100">
                  {l.providers?.translation?.join(", ")}
                </span>
              ) : null}
              {l.capabilities.realTimeVoice || l.capabilities.speechToText || l.capabilities.textToSpeech ? (
                <span className="text-[9px] uppercase text-slate-500">
                  {[l.capabilities.realTimeVoice ? "Realtime" : "",
                    l.capabilities.speechToText ? "STT" : "",
                    l.capabilities.textToSpeech ? "TTS" : ""]
                    .filter(Boolean)
                    .join(" · ") || ""}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {(query.data?.warnings?.length ?? 0) > 0 ? (
        <p className="mt-2 text-[10px] text-amber-200/90">
          {(query.data?.warnings ?? []).slice(0, 3).join(" ")}
        </p>
      ) : null}
    </div>
  );
}
