"use client";

import type { CallAssistCadReviewField } from "rapid-cortex-shared";
import { isCadWritebackUiEnabled } from "@/lib/runtime-flags";

export function CadPushBlock({
  cadProviderLabel,
  fields,
  lastStatus,
  cadIncidentId,
  canPush,
  pending,
  onPush,
}: {
  cadProviderLabel: string;
  fields: CallAssistCadReviewField[];
  lastStatus?: string;
  cadIncidentId?: string;
  canPush: boolean;
  pending: boolean;
  onPush: () => void;
}) {
  const writebackOn = isCadWritebackUiEnabled();
  return (
    <div className="mb-3 rounded-lg border border-amber-500/25 bg-slate-950 px-3 py-2.5">
      <p className="mb-2 text-[10px] font-semibold text-amber-400">
        CAD push ready — review before sending to {cadProviderLabel}
      </p>
      {fields.map((f) => (
        <div key={f.k} className="mb-0.5 flex gap-2 text-[11px]">
          <span className="min-w-[82px] text-slate-500">{f.k}</span>
          <span className={f.highlight ? "text-rose-300" : "text-slate-200"}>{f.v}</span>
        </div>
      ))}
      {lastStatus ? (
        <p className="mt-2 text-[11px] text-slate-400">
          Last result: {lastStatus}
          {cadIncidentId ? ` · ${cadIncidentId}` : ""}
        </p>
      ) : null}
      {!writebackOn ? (
        <p className="mt-2 text-[11px] text-slate-500">
          Selecting a provider does not enable write-back. Write-back is configured separately and
          requires a signed addendum.
        </p>
      ) : null}
      {canPush ? (
        <div className="mt-2">
          <button
            type="button"
            className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-300 disabled:opacity-50"
            onClick={onPush}
            disabled={pending || !writebackOn}
          >
            Send to {cadProviderLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
