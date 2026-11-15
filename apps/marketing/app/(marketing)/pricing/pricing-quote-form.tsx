"use client";

import { type FormEvent, useState } from "react";
import { Loader2, CheckCircle2, Lock } from "lucide-react";
import {
  QUOTE_REQUEST_AGENCY_TYPES,
  QUOTE_REQUEST_AGENCY_TYPE_LABELS,
  QUOTE_REQUEST_POPULATION_RANGES,
  QUOTE_REQUEST_POPULATION_LABELS,
  QUOTE_REQUEST_POSITION_RANGES,
  QUOTE_REQUEST_POSITION_LABELS,
  QUOTE_REQUEST_PRODUCTS,
  QUOTE_REQUEST_PRODUCT_LABELS,
  QUOTE_REQUEST_TIMELINES,
  QUOTE_REQUEST_TIMELINE_LABELS,
  type QuoteRequestAgencyType,
  type QuoteRequestPopulationRange,
  type QuoteRequestPositionRange,
  type QuoteRequestTimeline,
} from "./pricing-constants";
import {
  MARKETING_FORM_INPUT_CLASS,
  MARKETING_FORM_TEXTAREA_CLASS,
  quoteRequestSubmitUrl,
  scrollMarketingFieldIntoViewOnFocus,
} from "@/lib/marketing-form-input";

const SELECT_CLASS =
  "mt-2 h-12 w-full rounded-lg border border-slate-700 bg-slate-900 px-4 text-base text-slate-100 disabled:opacity-60 appearance-none";

const LABEL_CLASS = "block text-sm font-medium text-slate-300";

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className={LABEL_CLASS}>
      {children}
      {required && <span className="ml-1 text-sky-500">*</span>}
    </label>
  );
}

export function PricingQuoteForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setErrorMsg(null);

    const fd = new FormData(ev.currentTarget);
    const products = fd.getAll("products").filter((v): v is string => typeof v === "string");

    const payload = {
      agencyType: fd.get("agencyType") as QuoteRequestAgencyType,
      population: fd.get("population") as QuoteRequestPopulationRange,
      positions: fd.get("positions") as QuoteRequestPositionRange,
      cadSystem: (fd.get("cadSystem") as string | null)?.trim() || undefined,
      products,
      timeline: fd.get("timeline") as QuoteRequestTimeline,
      funding: (fd.get("funding") as string | null)?.trim() || undefined,
      name: (fd.get("name") as string | null)?.trim() ?? "",
      agencyName: (fd.get("agencyName") as string | null)?.trim() ?? "",
      email: (fd.get("email") as string | null)?.trim() ?? "",
      phone: (fd.get("phone") as string | null)?.trim() || undefined,
      notes: (fd.get("notes") as string | null)?.trim() || undefined,
    };

    try {
      const url = quoteRequestSubmitUrl();
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatus("success");
        return;
      }

      let msg = "Something went wrong. Please try again.";
      try {
        const j = (await res.json()) as { error?: string };
        if (j.error?.trim()) msg = j.error;
      } catch {
        /* plain text */
      }
      setErrorMsg(msg);
      setStatus("error");
    } catch {
      setErrorMsg("Network error. Please check your connection and try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl border border-sky-800/40 bg-sky-950/20 px-8 py-14 text-center">
        <CheckCircle2 className="h-10 w-10 text-sky-400" aria-hidden />
        <h3 className="text-xl font-semibold text-white">Your quote request is in.</h3>
        <p className="max-w-md text-sm text-slate-400">
          We'll review your agency profile and send a tailored quote within one business day.
          For urgent requests, reach us at{" "}
          <strong className="text-slate-200">(800) 555-0199</strong>.
        </p>
      </div>
    );
  }

  const isSending = status === "sending";

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      {/* Agency Profile */}
      <div>
        <h3 className="mb-5 text-sm font-semibold uppercase tracking-widest text-sky-500">
          Agency Profile
        </h3>
        <p className="mb-6 text-sm text-slate-400">
          This information routes your request to the right specialist and helps us structure a
          quote that fits your budget cycle, procurement process, and operational requirements.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel required>Agency Type</FieldLabel>
            <select name="agencyType" required defaultValue="" disabled={isSending} className={SELECT_CLASS}>
              <option value="" disabled>
                Select…
              </option>
              {QUOTE_REQUEST_AGENCY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {QUOTE_REQUEST_AGENCY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel required>Population Served</FieldLabel>
            <select name="population" required defaultValue="" disabled={isSending} className={SELECT_CLASS}>
              <option value="" disabled>
                Select…
              </option>
              {QUOTE_REQUEST_POPULATION_RANGES.map((r) => (
                <option key={r} value={r}>
                  {QUOTE_REQUEST_POPULATION_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel required>Dispatch Positions</FieldLabel>
            <select name="positions" required defaultValue="" disabled={isSending} className={SELECT_CLASS}>
              <option value="" disabled>
                Select…
              </option>
              {QUOTE_REQUEST_POSITION_RANGES.map((r) => (
                <option key={r} value={r}>
                  {QUOTE_REQUEST_POSITION_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel>Current CAD System</FieldLabel>
            <input
              type="text"
              name="cadSystem"
              placeholder="e.g. Motorola PremierOne, Tyler New World…"
              disabled={isSending}
              onFocus={scrollMarketingFieldIntoViewOnFocus}
              className={MARKETING_FORM_INPUT_CLASS}
            />
          </div>
        </div>
      </div>

      {/* Products of Interest */}
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-sky-500">
          Products of Interest
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {QUOTE_REQUEST_PRODUCTS.map((p) => (
            <label
              key={p}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-900/70"
            >
              <input
                type="checkbox"
                name="products"
                value={p}
                disabled={isSending}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-600 accent-sky-500"
              />
              <span>{QUOTE_REQUEST_PRODUCT_LABELS[p]}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Timeline & Funding */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <FieldLabel required>Purchase Timeline</FieldLabel>
          <select name="timeline" required defaultValue="" disabled={isSending} className={SELECT_CLASS}>
            <option value="" disabled>
              Select…
            </option>
            {QUOTE_REQUEST_TIMELINES.map((t) => (
              <option key={t} value={t}>
                {QUOTE_REQUEST_TIMELINE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Funding Source</FieldLabel>
          <input
            type="text"
            name="funding"
            placeholder="e.g. BRIC grant, E911 surcharge, general fund…"
            disabled={isSending}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
            className={MARKETING_FORM_INPUT_CLASS}
          />
        </div>
      </div>

      {/* Contact Info */}
      <div>
        <h3 className="mb-5 text-sm font-semibold uppercase tracking-widest text-sky-500">
          Contact Information
        </h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <FieldLabel required>Your Name</FieldLabel>
            <input
              type="text"
              name="name"
              required
              autoComplete="name"
              placeholder="Director Jane Smith"
              disabled={isSending}
              onFocus={scrollMarketingFieldIntoViewOnFocus}
              className={MARKETING_FORM_INPUT_CLASS}
            />
          </div>

          <div>
            <FieldLabel required>Agency Name</FieldLabel>
            <input
              type="text"
              name="agencyName"
              required
              placeholder="Franklin County 911"
              disabled={isSending}
              onFocus={scrollMarketingFieldIntoViewOnFocus}
              className={MARKETING_FORM_INPUT_CLASS}
            />
          </div>

          <div>
            <FieldLabel required>Work Email</FieldLabel>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="jane.smith@county.gov"
              disabled={isSending}
              onFocus={scrollMarketingFieldIntoViewOnFocus}
              className={MARKETING_FORM_INPUT_CLASS}
            />
          </div>

          <div>
            <FieldLabel>Phone</FieldLabel>
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              placeholder="(614) 555-0100"
              disabled={isSending}
              onFocus={scrollMarketingFieldIntoViewOnFocus}
              className={MARKETING_FORM_INPUT_CLASS}
            />
          </div>
        </div>

        <div className="mt-5">
          <FieldLabel>Anything else we should know?</FieldLabel>
          <textarea
            name="notes"
            rows={3}
            placeholder="Current pain points, procurement timeline, specific integrations needed…"
            disabled={isSending}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
            className={MARKETING_FORM_TEXTAREA_CLASS}
          />
        </div>
      </div>

      {/* Privacy note */}
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Lock className="h-3.5 w-3.5 flex-shrink-0" aria-hidden />
        Your information is used only to prepare your quote. We do not sell contact data.
      </p>

      {/* Error */}
      {status === "error" && errorMsg && (
        <p role="alert" className="rounded-lg border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {errorMsg}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-6 font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60 sm:w-auto"
      >
        {isSending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Sending…
          </>
        ) : (
          "Request My Quote →"
        )}
      </button>
    </form>
  );
}
