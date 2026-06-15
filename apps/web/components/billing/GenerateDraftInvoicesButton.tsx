"use client";

import Link from "next/link";
import { useState } from "react";

interface GenerateDraftInvoicesButtonProps {
  yearMonth: string;
}

interface BulkDraftResult {
  yearMonth: string;
  created: number;
  skipped: number;
  errors: string[];
  invoices: {
    invoiceId: string;
    agencyId: string;
    agencyName: string;
    total: number;
    lineItemCount: number;
  }[];
}

function formatPeriod(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

type Step = "idle" | "preview" | "confirming" | "done" | "error";

export function GenerateDraftInvoicesButton({ yearMonth }: GenerateDraftInvoicesButtonProps) {
  const [step, setStep] = useState<Step>("idle");
  const [preview, setPreview] = useState<BulkDraftResult | null>(null);
  const [result, setResult] = useState<BulkDraftResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const period = formatPeriod(yearMonth);

  async function handlePreview() {
    setStep("preview");
    setErrorMsg("");
    try {
      const res = await fetch("/api/rc-admin/invoices/bulk-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth, dryRun: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as BulkDraftResult;
      setPreview(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Preview failed.");
      setStep("error");
    }
  }

  async function handleConfirm() {
    setStep("confirming");
    try {
      const res = await fetch("/api/rc-admin/invoices/bulk-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearMonth, dryRun: false }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as BulkDraftResult;
      setResult(data);
      setStep("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Generation failed.");
      setStep("error");
    }
  }

  function reset() {
    setStep("idle");
    setPreview(null);
    setResult(null);
    setErrorMsg("");
  }

  const totalValue = (preview ?? result)?.invoices.reduce((s, i) => s + i.total, 0) ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={handlePreview}
        disabled={step !== "idle"}
        className="rounded border border-violet-700/50 bg-violet-900/30 px-3 py-1.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-900/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Generate draft invoices
      </button>

      {step !== "idle" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) reset();
          }}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-700/60 bg-slate-950 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  {step === "done" ? "Invoices created" : "Generate draft invoices"}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">{period}</p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded px-2 py-1 text-lg text-slate-500 hover:text-slate-300"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {step === "preview" && !preview ? (
              <p className="px-6 py-10 text-center text-sm text-slate-500">Checking usage and billing customers…</p>
            ) : null}

            {(step === "preview" || step === "confirming") && preview ? (
              <div className="px-6 py-5">
                <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Draft invoices to create</span>
                    <span className="font-semibold text-slate-100">{preview.created}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Skipped (existing draft or no billing customer)</span>
                    <span className="text-slate-500">{preview.skipped}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-slate-800 pt-2">
                    <span className="text-slate-400">Total value</span>
                    <span className="font-bold tabular-nums text-violet-300">{formatCurrency(totalValue)}</span>
                  </div>
                </div>

                {preview.invoices.length > 0 ? (
                  <div className="mb-4">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Invoices to be created
                    </p>
                    <div className="max-h-44 space-y-1 overflow-y-auto">
                      {preview.invoices.map((inv) => (
                        <div
                          key={inv.invoiceId}
                          className="flex justify-between border-b border-slate-800/60 py-1.5 text-xs"
                        >
                          <span className="text-slate-300">{inv.agencyName}</span>
                          <span className="tabular-nums text-violet-300">{formatCurrency(inv.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {preview.created === 0 ? (
                  <p className="mb-4 rounded-md border border-slate-700/50 bg-slate-900/40 px-3 py-2 text-xs text-slate-400">
                    No draft invoices to create. Agencies either already have a draft for {period} or are missing a
                    billing customer record.
                  </p>
                ) : (
                  <p className="mb-4 rounded-md border border-amber-700/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
                    Drafts will be created but not sent. Review them at{" "}
                    <Link href="/rc-admin/invoices" className="underline hover:text-amber-100">
                      /rc-admin/invoices
                    </Link>{" "}
                    before sending.
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={step === "confirming"}
                    className="rounded border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:bg-slate-900"
                  >
                    Cancel
                  </button>
                  {preview.created > 0 ? (
                    <button
                      type="button"
                      onClick={handleConfirm}
                      disabled={step === "confirming"}
                      className="rounded bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-70"
                    >
                      {step === "confirming"
                        ? "Creating…"
                        : `Create ${preview.created} draft invoice${preview.created !== 1 ? "s" : ""}`}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === "done" && result ? (
              <div className="px-6 py-5">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-950/40 text-lg">
                    ✓
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">
                      {result.created} draft invoice{result.created !== 1 ? "s" : ""} created
                    </p>
                    <p className="text-xs text-slate-500">
                      Total: {formatCurrency(result.invoices.reduce((s, i) => s + i.total, 0))} — not yet sent
                    </p>
                  </div>
                </div>

                {result.errors.length > 0 ? (
                  <p className="mb-4 rounded-md border border-red-800/40 bg-red-950/20 px-3 py-2 text-xs text-red-300">
                    {result.errors.length} error{result.errors.length !== 1 ? "s" : ""}:{" "}
                    {result.errors.slice(0, 3).join("; ")}
                  </p>
                ) : null}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:bg-slate-900"
                  >
                    Close
                  </button>
                  <Link
                    href="/rc-admin/invoices"
                    className="rounded bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-500"
                  >
                    View & send invoices →
                  </Link>
                </div>
              </div>
            ) : null}

            {step === "error" ? (
              <div className="px-6 py-5">
                <p className="mb-4 rounded-md border border-red-800/40 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                  {errorMsg || "An unexpected error occurred."}
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded border border-slate-700 px-4 py-2 text-xs text-slate-400 hover:bg-slate-900"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
