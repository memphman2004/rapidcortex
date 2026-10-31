"use client";

import { useEffect, useState } from "react";
import type { IntelligenceProviderStatus } from "@/lib/rapid-vision/intelligence-provider";
import type { StudioReviewRecord } from "@/lib/rapid-vision/studio-dataset";

type ProviderPayload = IntelligenceProviderStatus & {
  storage?: "dynamodb" | "unavailable";
  reviews?: StudioReviewRecord[];
  gaps?: { category: string; need: string }[];
  liveDetection?: "disabled";
};

export function IntelligenceProviders() {
  const [status, setStatus] = useState<ProviderPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/rc-admin/vision/intelligence")
      .then(async (res) => {
        const body = (await res.json()) as ProviderPayload & { error?: string };
        if (!res.ok) throw new Error(body.error || "The provider status did not load.");
        if (!cancelled) setStatus(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "The provider status did not load.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function requestReview() {
    setReviewNote(null);
    const res = await fetch("/api/rc-admin/vision/intelligence", { method: "POST" });
    const body = (await res.json()) as { reason?: string; error?: string };
    setReviewNote(body.reason || body.error || "No frame was sent.");
  }

  if (error) return <p className="text-sm text-amber-100">{error}</p>;
  if (!status) return <p className="text-sm text-slate-400">Loading provider status…</p>;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">OpenAI</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          Secret <span className="text-slate-200">{status.secretName}</span> is reused. Format: {status.secretFormat}. The key is not shown.
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <StatusItem label="Connection" value={status.connection} detail={status.executionRoleDetail} />
        <StatusItem label="Secret retrieval" value={status.secretRetrieval} detail={status.secretFormat} />
        <StatusItem label="Last successful request" value={status.lastSuccessAt ?? "None"} detail={status.lastError ?? "No error stored."} />
        <StatusItem label="Visual analysis" value={status.visualAnalysis} detail={status.frameReviewReason} />
        <StatusItem label="Image generation" value={status.imageGeneration} detail="One synthetic image was requested at low quality. It is not approved." />
        <StatusItem label="Usage" value={status.usage ? `${status.usage.totalTokens} tokens` : "None"} detail={status.costNote} />
      </dl>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Function</th>
              <th className="px-3 py-2">Model</th>
              <th className="px-3 py-2">Access</th>
            </tr>
          </thead>
          <tbody>
            {status.models.map((item) => (
              <tr key={item.role} className="border-t border-slate-800">
                <td className="px-3 py-2">{item.role}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-300">{item.id}</td>
                <td className="px-3 py-2 text-slate-400">{item.availability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Stored candidates</h3>
        <p className="text-xs text-slate-500">
          Storage: {status.storage === "dynamodb" ? "vision events table" : "not reachable from this server"}. Rights, labels, and approval are on the Labeling tab. Live detection is disabled. Nothing here opens a CAD incident.
        </p>
        <p className="text-sm text-slate-300">{(status.reviews ?? []).length} candidate{(status.reviews ?? []).length === 1 ? "" : "s"} retrieved for this session.</p>
        {(status.reviews ?? []).map((item) => (
          <p key={item.id} className="text-xs text-slate-400">{item.id} · {item.status} · {item.trainingLabel ? "label verified" : "label unverified"}</p>
        ))}
      </div>
      <button type="button" onClick={() => void requestReview()} className="rounded bg-slate-800 px-3 py-1.5 text-sm">
        Send another frame
      </button>
      {reviewNote ? <p className="text-sm text-amber-100">{reviewNote}</p> : null}
    </section>
  );
}

function StatusItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-800 p-3">
      <dt className="text-[10px] uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
      <dd className="mt-1 text-xs text-slate-400">{detail}</dd>
    </div>
  );
}
