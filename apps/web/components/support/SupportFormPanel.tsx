"use client";

import { useEffect, useState } from "react";
import {
  CATEGORY_LABELS,
  RC_SUPPORT_PHONE,
  SEVERITY_CONFIG,
  TICKET_SEVERITIES,
  categoriesForRole,
  type SubmitTicketBody,
  type SubmitTicketResponse,
  type SupportCategory,
  type TicketSeverity,
} from "rapid-cortex-shared";
import { SupportConfirmation } from "./SupportConfirmation";

type FormStep = "form" | "submitting" | "confirmed" | "sev1_intercept";

type Props = {
  open: boolean;
  onClose: () => void;
  userRole: string;
  agencyId: string;
  agencyName: string;
  userId: string;
  userEmail: string;
  userName: string;
};

const INPUT_CLS =
  "w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500";
const SELECT_CLS =
  "w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500";

export function SupportFormPanel({
  open,
  onClose,
  userRole,
  agencyName,
  userName,
}: Props) {
  const [step, setStep] = useState<FormStep>("form");
  const [category, setCategory] = useState<SupportCategory | "">("");
  const [severity, setSeverity] = useState<TicketSeverity>("SEV4");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<SubmitTicketResponse | null>(null);

  useEffect(() => {
    if (open) {
      setStep("form");
      setCategory("");
      setSeverity("SEV4");
      setSubject("");
      setDescription("");
      setError(null);
      setTicket(null);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const categories = categoriesForRole(userRole);

  function handleSeverityChange(sev: TicketSeverity) {
    setSeverity(sev);
    if (sev === "SEV1") {
      setStep("sev1_intercept");
    } else if (step === "sev1_intercept") {
      setStep("form");
    }
  }

  async function handleSubmit() {
    if (!category || !subject.trim() || !description.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (severity === "SEV1") {
      setStep("sev1_intercept");
      return;
    }

    setStep("submitting");
    setError(null);

    const body: SubmitTicketBody = {
      category,
      severity,
      subject: subject.trim(),
      description: description.trim(),
      currentPageUrl: typeof window !== "undefined" ? window.location.href : undefined,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      agencyName,
    };

    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as SubmitTicketResponse & {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setTicket(data);
      setStep("confirmed");
    } catch {
      setError(
        "Failed to submit your ticket. Please try again or email support@rapidcortex.us directly.",
      );
      setStep("form");
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-slate-800 bg-[#070d1e] shadow-2xl"
        role="dialog"
        aria-label="Support request"
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
              Rapid Cortex
            </p>
            <h2 className="text-sm font-semibold text-white">Support Request</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {step === "sev1_intercept" && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/[0.06] p-5">
              <div className="mb-2 text-sm font-bold text-red-400">⚠ Critical / Active Outage</div>
              <p className="mb-4 text-[13px] leading-relaxed text-red-300/80">
                Web form submissions are not monitored in real time. For active outages affecting
                911 operations, call the RC Support Line immediately:
              </p>
              <div className="mb-4 rounded-md border border-red-500/30 bg-red-950/40 px-4 py-3 text-center">
                <p className="text-xs text-red-400/60">RC Support Line</p>
                <p className="mt-0.5 text-lg font-bold tracking-wide text-red-300">
                  {RC_SUPPORT_PHONE}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSeverity("SEV2");
                  setStep("form");
                }}
                className="w-full rounded border border-slate-700 py-2 text-xs text-slate-400 hover:bg-slate-800"
              >
                My issue is not an active outage — continue with form
              </button>
            </div>
          )}

          {step === "confirmed" && ticket && (
            <SupportConfirmation
              ticket={ticket}
              agencyName={agencyName}
              userName={userName}
              onDone={onClose}
            />
          )}

          {(step === "form" || step === "submitting") && (
            <div className="space-y-4">
              <div className="rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2.5">
                <p className="text-[10px] text-slate-500">
                  Submitting as <span className="text-slate-300">{userName}</span> · {agencyName} ·{" "}
                  <span className="capitalize">{userRole}</span>
                </p>
              </div>

              <Field label="Issue Category" required>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportCategory)}
                  className={SELECT_CLS}
                >
                  <option value="">Select a category…</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Severity" required>
                <div className="grid grid-cols-2 gap-2">
                  {TICKET_SEVERITIES.map((sev) => {
                    const cfg = SEVERITY_CONFIG[sev];
                    const selected = severity === sev;
                    return (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => handleSeverityChange(sev)}
                        className={[
                          "rounded border px-3 py-2 text-left text-[11px] font-semibold transition",
                          selected
                            ? `${cfg.bgClass} ${cfg.textClass} border-transparent`
                            : "border-slate-800 text-slate-500 hover:border-slate-700",
                        ].join(" ")}
                      >
                        <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${cfg.dotClass}`} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <Field label="Subject" required>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  placeholder="Brief summary of the issue"
                  className={INPUT_CLS}
                />
              </Field>

              <Field label="Description" required>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={7}
                  maxLength={8000}
                  placeholder="What happened, what you expected, and any error text."
                  className={`${INPUT_CLS} resize-none`}
                />
              </Field>

              {error && <p className="text-[12px] text-red-400">{error}</p>}

              <button
                type="button"
                disabled={step === "submitting"}
                onClick={() => void handleSubmit()}
                className="w-full rounded bg-sky-600 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-40"
              >
                {step === "submitting" ? "Submitting…" : "Submit ticket"}
              </button>
              <p className="text-center text-[10px] text-slate-600">
                Urgent? Call support directly · {RC_SUPPORT_PHONE}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold text-slate-400">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
