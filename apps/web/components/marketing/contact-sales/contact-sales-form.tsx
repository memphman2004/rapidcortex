"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  MARKETING_FORM_INPUT_CLASS,
  MARKETING_FORM_TEXTAREA_CLASS,
  scrollMarketingFieldIntoViewOnFocus,
} from "@/lib/marketing-form-input";

const CUSTOMER_TYPES = [
  ["agency", "Agency PSAP"],
  ["city", "City"],
  ["county", "County"],
  ["state", "State"],
  ["venue", "Venue / events"],
  ["campus", "Campus / K-12 & university"],
  ["vendor", "Vendor / OEM"],
  ["other", "Other"],
] as const;

const INTERESTS = [
  ["dashboard_platform", "Dashboard platform"],
  ["api_access", "API access"],
  ["cad_integration", "CAD integration"],
  ["pilot_program", "Pilot program"],
  ["enterprise_statewide", "Enterprise / statewide deployment"],
] as const;

export type ContactSalesFormProps = {
  /** Mirrors `?interest=` on the URL; pass from server `page` to avoid Suspense stalls on `useSearchParams()`. */
  interestFromSearch?: string | null;
  onSuccess?: (payload: { leadId?: string | null }) => void;
};

export function ContactSalesForm({ interestFromSearch = null, onSuccess }: ContactSalesFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaultInterestPilot = interestFromSearch === "pilot_program";

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setErrorMessage(null);
    const fd = new FormData(ev.currentTarget);

    const interestedRaw = fd.getAll("interestedIn");
    const interestedIn =
      typeof interestedRaw[0] === "string" && interestedRaw.length >= 1
        ? interestedRaw.filter((x): x is string => typeof x === "string")
        : ([] as string[]);

    const body = {
      name: String(fd.get("name") ?? "").trim(),
      email: String(fd.get("email") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim() || undefined,
      agencyCompany: String(fd.get("agencyCompany") ?? "").trim(),
      role: String(fd.get("role") ?? "").trim() || undefined,
      customerType: String(fd.get("customerType") ?? "other"),
      interestedIn:
        interestedIn.length > 0
          ? interestedIn
          : defaultInterestPilot
            ? ["pilot_program"]
            : ["dashboard_platform"],
      estimatedAgencySize: String(fd.get("estimatedAgencySize") ?? "").trim() || undefined,
      message: String(fd.get("message") ?? "").trim() || undefined,
      website: String(fd.get("website") ?? ""),
    };

    try {
      const res = await fetch("/api/contact-sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      /** Read raw text first: avoids failing the whole flow if `res.ok` but `res.json()` rejects. */
      const raw = await res.text();
      let j = {} as { ok?: boolean; leadId?: string; error?: string; message?: string };
      if (raw.trim()) {
        try {
          j = JSON.parse(raw) as typeof j;
        } catch {
          /* non-JSON body on 2xx — still treat as success once `res.ok` below */
        }
      }
      /** Lead API returns `202 Accepted` with JSON; any 2xx counts as success (`res.ok` is 200–299). */
      if (!res.ok) {
        const serverMsg =
          (typeof j.error === "string" && j.error.trim()) ||
          (typeof j.message === "string" && j.message.trim()) ||
          "";
        const msg = serverMsg || `Request failed (${res.status}).`;
        throw new Error(msg);
      }

      ev.currentTarget.reset();
      setStatus("idle");
      onSuccess?.({ leadId: typeof j.leadId === "string" ? j.leadId : null });
    } catch (err) {
      setStatus("error");
      const fromServer =
        err instanceof Error && err.message.trim().length > 0 && err.message !== "fail" ? err.message.trim() : null;
      setErrorMessage(fromServer ?? "Unable to submit request right now. Please try again.");
    }
  }

  return (
    <motion.form
      layout
      className="mt-10 space-y-6 rounded-3xl border border-slate-800/90 bg-slate-950/50 p-4 shadow-inner shadow-slate-950/40 sm:p-8"
      onSubmit={handleSubmit}
      aria-busy={status === "sending"}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-300">
          Name
          <input
            required
            name="name"
            autoComplete="name"
            disabled={status === "sending"}
            className={MARKETING_FORM_INPUT_CLASS}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          />
        </label>
        <label className="block text-sm font-medium text-slate-300">
          Email
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            disabled={status === "sending"}
            className={MARKETING_FORM_INPUT_CLASS}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          />
        </label>
        <label className="block text-sm font-medium text-slate-300">
          Phone <span className="font-normal text-slate-600">optional</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            disabled={status === "sending"}
            className={MARKETING_FORM_INPUT_CLASS}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          />
        </label>
        <label className="block text-sm font-medium text-slate-300">
          Agency / company
          <input
            required
            name="agencyCompany"
            autoComplete="organization"
            disabled={status === "sending"}
            className={MARKETING_FORM_INPUT_CLASS}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-300">
          Role <span className="font-normal text-slate-600">optional</span>
          <input
            name="role"
            disabled={status === "sending"}
            className={MARKETING_FORM_INPUT_CLASS}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          />
        </label>
        <label className="block text-sm font-medium text-slate-300">
          Customer type
          <select
            required
            name="customerType"
            disabled={status === "sending"}
            className={MARKETING_FORM_INPUT_CLASS}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
            defaultValue="agency"
          >
            {CUSTOMER_TYPES.map(([id, lab]) => (
              <option key={id} value={id}>
                {lab}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset disabled={status === "sending"}>
        <legend className="text-sm font-semibold text-slate-200">Interested in</legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {INTERESTS.map(([id, lab]) => (
            <label key={id} className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                name="interestedIn"
                defaultChecked={
                  (defaultInterestPilot && id === "pilot_program") ||
                  (!defaultInterestPilot && id === "dashboard_platform")
                }
                value={id}
                className="rounded border-slate-600 bg-slate-900"
              />{" "}
              {lab}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-medium text-slate-300">
        Estimated agency size <span className="font-normal text-slate-600">optional</span>
        <input
          name="estimatedAgencySize"
          placeholder="approx. dispatcher seats"
          disabled={status === "sending"}
          className={MARKETING_FORM_INPUT_CLASS}
          onFocus={scrollMarketingFieldIntoViewOnFocus}
        />
      </label>
      <label className="block text-sm font-medium text-slate-300">
        Message
        <textarea
          name="message"
          rows={4}
          disabled={status === "sending"}
          className={MARKETING_FORM_TEXTAREA_CLASS}
          onFocus={scrollMarketingFieldIntoViewOnFocus}
        />
      </label>
      <input
        aria-hidden="true"
        tabIndex={-1}
        name="website"
        autoComplete="off"
        className="hidden"
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-5 py-3 text-base font-semibold text-white shadow-sm shadow-sky-950/30 hover:bg-sky-500 disabled:pointer-events-none disabled:opacity-70 sm:w-auto sm:min-w-[160px] sm:text-sm"
        >
          {status === "sending" ? (
            <>
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              <span>Sending…</span>
            </>
          ) : (
            "Submit inquiry"
          )}
        </button>
        <button
          type="button"
          disabled={status === "sending"}
          onClick={() => router.push("/pricing")}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-600 px-4 py-3 text-base text-slate-200 hover:bg-slate-900 disabled:opacity-50 sm:w-auto sm:text-sm"
        >
          Back to pricing
        </button>
      </div>
      <div role="alert" aria-live="assertive" className="min-h-[1.25rem]">
        {errorMessage ? <p className="text-sm text-amber-200/90">{errorMessage}</p> : null}
      </div>
    </motion.form>
  );
}
