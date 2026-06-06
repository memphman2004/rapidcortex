"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  MARKETING_FORM_INPUT_CLASS,
  MARKETING_FORM_TEXTAREA_CLASS,
  scrollMarketingFieldIntoViewOnFocus,
} from "@/lib/marketing-form-input";

const AGENCY_TYPES = [
  { value: "psap", label: "PSAP/911 Center", customerType: "agency" as const },
  { value: "law_enforcement", label: "Law Enforcement", customerType: "agency" as const },
  { value: "fire", label: "Fire Department", customerType: "agency" as const },
  { value: "ems", label: "EMS", customerType: "agency" as const },
  { value: "multi", label: "Multi-Agency", customerType: "agency" as const },
  { value: "other", label: "Other", customerType: "other" as const },
] as const;

const DISPATCHER_BANDS = [
  { value: "1-5", label: "1–5" },
  { value: "6-15", label: "6–15" },
  { value: "16-50", label: "16–50" },
  { value: "50+", label: "50+" },
] as const;

const inputClass = MARKETING_FORM_INPUT_CLASS;
const textareaClass = MARKETING_FORM_TEXTAREA_CLASS;
const labelClass = "block text-sm font-medium text-slate-300";

export function DemoRequestForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setErrorMessage(null);
    const fd = new FormData(ev.currentTarget);

    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const agencyCompany = String(fd.get("agencyCompany") ?? "").trim();
    const role = String(fd.get("role") ?? "").trim();
    const agencyTypeValue = String(fd.get("agencyType") ?? "other");
    const dispatchers = String(fd.get("dispatchers") ?? "").trim();
    const userMessage = String(fd.get("message") ?? "").trim();

    const agencyMeta = AGENCY_TYPES.find((a) => a.value === agencyTypeValue) ?? AGENCY_TYPES[AGENCY_TYPES.length - 1];
    const dispatcherLabel = DISPATCHER_BANDS.find((d) => d.value === dispatchers)?.label ?? dispatchers;

    const messageLines = [
      "Source: /demo — Request live demo",
      `Agency type: ${agencyMeta.label}`,
      `Dispatchers (band): ${dispatcherLabel}`,
    ];
    if (userMessage) {
      messageLines.push("", userMessage);
    }
    const message = messageLines.join("\n").slice(0, 5000);

    const body = {
      name,
      email,
      agencyCompany,
      role: role || undefined,
      customerType: agencyMeta.customerType,
      interestedIn: ["pilot_program", "dashboard_platform"],
      estimatedAgencySize: dispatchers || undefined,
      message: message.length > 0 ? message : undefined,
      website: String(fd.get("website") ?? ""),
    };

    try {
      const res = await fetch("/api/contact-sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let j = {} as { ok?: boolean; error?: string };
      if (raw.trim()) {
        try {
          j = JSON.parse(raw) as typeof j;
        } catch {
          /* ignore */
        }
      }
      if (!res.ok) {
        const msg =
          typeof j.error === "string" && j.error.trim().length > 0 ? j.error.trim() : `Request failed (${res.status}).`;
        throw new Error(msg);
      }
      ev.currentTarget.reset();
      setStatus("success");
    } catch (err) {
      setStatus("idle");
      const fromServer =
        err instanceof Error && err.message.trim().length > 0 ? err.message.trim() : null;
      setErrorMessage(fromServer ?? "Unable to submit right now. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-2xl border border-emerald-500/30 bg-emerald-950/25 px-6 py-8 text-center shadow-inner"
        role="status"
      >
        <p className="text-lg font-semibold leading-snug text-emerald-100">
          We&apos;ll be in touch within one business day.
        </p>
        <p className="mt-3 text-sm text-emerald-200/85">Thank you for your interest in Rapid Cortex.</p>
      </div>
    );
  }

  return (
    <form
      className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-slate-800/90 bg-slate-950/50 p-4 shadow-inner shadow-slate-950/40 sm:p-8"
      onSubmit={handleSubmit}
      aria-busy={status === "sending"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Full name <span className="text-rose-300">*</span>
          <input
            required
            name="name"
            autoComplete="name"
            disabled={status === "sending"}
            className={inputClass}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          />
        </label>
        <label className={labelClass}>
          Work email <span className="text-rose-300">*</span>
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            disabled={status === "sending"}
            className={inputClass}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          />
        </label>
      </div>
      <label className={labelClass}>
        Agency / organization <span className="text-rose-300">*</span>
        <input
          required
          name="agencyCompany"
          autoComplete="organization"
          disabled={status === "sending"}
          className={inputClass}
          onFocus={scrollMarketingFieldIntoViewOnFocus}
        />
      </label>
      <label className={labelClass}>
        Role / title <span className="text-rose-300">*</span>
        <input
          required
          name="role"
          autoComplete="organization-title"
          disabled={status === "sending"}
          className={inputClass}
          onFocus={scrollMarketingFieldIntoViewOnFocus}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Agency type <span className="text-rose-300">*</span>
          <select
            required
            name="agencyType"
            disabled={status === "sending"}
            className={inputClass}
            defaultValue="psap"
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          >
            {AGENCY_TYPES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Number of dispatchers <span className="text-rose-300">*</span>
          <select
            required
            name="dispatchers"
            disabled={status === "sending"}
            className={inputClass}
            defaultValue="6-15"
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          >
            {DISPATCHER_BANDS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={labelClass}>
        Message <span className="font-normal text-slate-500">(optional)</span>
        <textarea
          name="message"
          rows={4}
          disabled={status === "sending"}
          className={textareaClass}
          onFocus={scrollMarketingFieldIntoViewOnFocus}
        />
      </label>
      <input type="text" name="website" autoComplete="off" tabIndex={-1} className="hidden" aria-hidden />
      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-sm shadow-sky-950/30 hover:bg-sky-500 disabled:pointer-events-none disabled:opacity-70 sm:w-auto sm:text-sm"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Sending…
          </>
        ) : (
          "Request live demo"
        )}
      </button>
      <p className="text-xs text-slate-500">We never share your information.</p>
      <div role="alert" aria-live="assertive" className="min-h-[1.25rem]">
        {errorMessage ? <p className="text-sm text-amber-200/90">{errorMessage}</p> : null}
      </div>
    </form>
  );
}
