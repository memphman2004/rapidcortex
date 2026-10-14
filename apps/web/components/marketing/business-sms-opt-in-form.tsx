"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { BUSINESS_SMS_DISCLOSURE_VERSION } from "rapid-cortex-shared";
import { BusinessSmsConsentField } from "@/components/marketing/business-sms-consent-field";
import {
  MARKETING_FORM_INPUT_CLASS,
  MARKETING_FORM_TEXTAREA_CLASS,
  contactSalesSubmitUrl,
  scrollMarketingFieldIntoViewOnFocus,
} from "@/lib/marketing-form-input";

const labelClass = "block text-sm font-medium text-slate-300";

/**
 * Public Business Communications SMS opt-in inquiry form for /sms-consent/.
 * Does not send SMS on submit — only records consent when the checkbox is checked.
 */
export function BusinessSmsOptInForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "success">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (status === "sending") return;

    const form = ev.currentTarget;
    setStatus("sending");
    setErrorMessage(null);
    const fd = new FormData(form);

    const name = String(fd.get("name") ?? "").trim();
    const email = String(fd.get("email") ?? "").trim();
    const phone = String(fd.get("phone") ?? "").trim();
    const agencyCompany = String(fd.get("agencyCompany") ?? "").trim();
    const userMessage = String(fd.get("message") ?? "").trim();
    const smsConsentOptedIn = fd.get("smsConsentOptedIn") === "1";

    if (smsConsentOptedIn && !phone) {
      setStatus("idle");
      setErrorMessage("Enter a mobile phone number to opt in to SMS, or uncheck the SMS consent box.");
      return;
    }

    const messageLines = [
      "Source: /sms-consent/#opt-in-form — Business Communications SMS inquiry",
    ];
    if (userMessage) messageLines.push("", userMessage);

    const body = {
      name,
      email,
      phone: phone || undefined,
      agencyCompany,
      customerType: "other" as const,
      interestedIn: ["pilot_program", "dashboard_platform"] as const,
      message: messageLines.join("\n").slice(0, 5000),
      website: String(fd.get("website") ?? ""),
      smsConsentOptedIn,
      smsConsentDisclosureVersion: String(
        fd.get("smsConsentDisclosureVersion") ?? BUSINESS_SMS_DISCLOSURE_VERSION,
      ).trim(),
      formSource: "sms-consent" as const,
    };

    try {
      const res = await fetch(contactSalesSubmitUrl(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let j = {} as { ok?: boolean; leadId?: string; error?: string };
      if (raw.trim()) {
        try {
          j = JSON.parse(raw) as typeof j;
        } catch {
          /* non-JSON */
        }
      }
      const accepted = res.ok && (j.ok === true || typeof j.leadId === "string");
      if (!accepted) {
        throw new Error(
          typeof j.error === "string" && j.error.trim()
            ? j.error.trim()
            : `Request failed (${res.status}).`,
        );
      }
      form.reset();
      setStatus("success");
    } catch (err) {
      setStatus("idle");
      setErrorMessage(
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : "Unable to submit right now. Please try again.",
      );
    }
  }

  if (status === "success") {
    return (
      <div
        className="rounded-2xl border border-emerald-500/30 bg-emerald-950/25 px-6 py-8 text-center"
        role="status"
      >
        <p className="text-lg font-semibold text-emerald-100">Thank you — we received your request.</p>
        <p className="mt-3 text-sm text-emerald-200/85">
          If you opted in to SMS, a NexCort iQ representative may text you about your inquiry. Reply
          STOP anytime to opt out.
        </p>
      </div>
    );
  }

  return (
    <form
      id="business-sms-opt-in-form"
      className="space-y-5 rounded-2xl border border-amber-700/40 bg-[#1a1208] p-4 shadow-inner sm:p-6"
      onSubmit={handleSubmit}
      aria-busy={status === "sending"}
      aria-labelledby="opt-in-form-heading"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Full name <span className="text-rose-300">*</span>
          <input
            required
            name="name"
            autoComplete="name"
            disabled={status === "sending"}
            className={MARKETING_FORM_INPUT_CLASS}
            onFocus={scrollMarketingFieldIntoViewOnFocus}
          />
        </label>
        <label className={labelClass}>
          Business email <span className="text-rose-300">*</span>
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
      </div>
      <label className={labelClass}>
        Mobile phone number{" "}
        <span className="font-normal text-slate-500">(required only if you opt in to SMS)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          disabled={status === "sending"}
          className={MARKETING_FORM_INPUT_CLASS}
          onFocus={scrollMarketingFieldIntoViewOnFocus}
        />
      </label>
      <BusinessSmsConsentField disabled={status === "sending"} />
      <label className={labelClass}>
        Organization / agency <span className="text-rose-300">*</span>
        <input
          required
          name="agencyCompany"
          autoComplete="organization"
          disabled={status === "sending"}
          className={MARKETING_FORM_INPUT_CLASS}
          onFocus={scrollMarketingFieldIntoViewOnFocus}
        />
      </label>
      <label className={labelClass}>
        Message <span className="font-normal text-slate-500">(optional)</span>
        <textarea
          name="message"
          rows={3}
          disabled={status === "sending"}
          className={MARKETING_FORM_TEXTAREA_CLASS}
          onFocus={scrollMarketingFieldIntoViewOnFocus}
          placeholder="Tell us what you would like to discuss"
        />
      </label>
      <input type="text" name="website" autoComplete="off" tabIndex={-1} className="hidden" aria-hidden />
      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-6 py-3 text-base font-semibold text-white hover:bg-sky-500 disabled:opacity-70 sm:w-auto sm:text-sm"
      >
        {status === "sending" ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Submitting…
          </>
        ) : (
          "Submit Request"
        )}
      </button>
      <p className="text-xs text-slate-500">
        Submitting this form does not automatically send you a text message. SMS is only sent by an
        authorized NexCort iQ representative after you opt in.
      </p>
      <div role="alert" aria-live="assertive" className="min-h-[1.25rem]">
        {errorMessage ? <p className="text-sm text-amber-200/90">{errorMessage}</p> : null}
      </div>
    </form>
  );
}
