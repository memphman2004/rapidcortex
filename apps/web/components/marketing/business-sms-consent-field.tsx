"use client";

import {
  BUSINESS_SMS_CONSENT_CHECKBOX_LABEL,
  BUSINESS_SMS_DISCLOSURE_VERSION,
  BUSINESS_SMS_NO_SHARE_STATEMENT,
} from "rapid-cortex-shared";

const TERMS_HREF = "https://www.nexcortiq.us/terms";
const PRIVACY_HREF = "https://www.nexcortiq.us/privacy/";
const SMS_DISCLOSURE_HREF = "https://www.nexcortiq.us/sms-consent/";

type BusinessSmsConsentFieldProps = {
  disabled?: boolean;
};

/**
 * Unchecked-by-default SMS opt-in for sms-consent, contact-sales, and demo forms.
 * Links Terms, Privacy, and SMS Consent Disclosure for Microsoft / carrier CTA review.
 */
export function BusinessSmsConsentField({ disabled = false }: BusinessSmsConsentFieldProps) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-3 sm:px-4">
      <input type="hidden" name="smsConsentDisclosureVersion" value={BUSINESS_SMS_DISCLOSURE_VERSION} />
      <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-300">
        <input
          type="checkbox"
          name="smsConsentOptedIn"
          value="1"
          defaultChecked={false}
          disabled={disabled}
          className="mt-1 h-4 w-4 shrink-0 rounded border-slate-600 bg-slate-900 text-sky-600 focus:ring-sky-500/40"
        />
        <span>{BUSINESS_SMS_CONSENT_CHECKBOX_LABEL}</span>
      </label>
      <p className="pl-7 text-xs leading-relaxed text-slate-400">{BUSINESS_SMS_NO_SHARE_STATEMENT}</p>
      <p className="pl-7 text-xs text-slate-500">
        <a href={TERMS_HREF} className="text-sky-400 underline-offset-2 hover:underline">
          SMS Terms
        </a>
        {" · "}
        <a href={PRIVACY_HREF} className="text-sky-400 underline-offset-2 hover:underline">
          Privacy Policy
        </a>
        {" · "}
        <a href={SMS_DISCLOSURE_HREF} className="text-sky-400 underline-offset-2 hover:underline">
          SMS Consent Disclosure
        </a>
      </p>
    </div>
  );
}
