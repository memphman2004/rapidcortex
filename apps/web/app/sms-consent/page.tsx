import { redirect } from "next/navigation";

/**
 * Canonical SMS Consent & Messaging Disclosure lives on the marketing host.
 * Keep a single public policy for Microsoft / carrier campaign review.
 */
export default function SmsConsentRedirectPage() {
  redirect("https://www.nexcortiq.us/sms-consent/");
}
