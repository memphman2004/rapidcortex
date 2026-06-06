import Link from "next/link";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { marketingContactPath, marketingPrivacyPath, marketingTermsPath } from "@/lib/marketing-links";
import { SITE_NAME, SITE_OPERATOR_NAME, SITE_OPERATOR_URL } from "@/lib/site";

const PAGE_TITLE = "SMS Consent";

export const metadata = {
  title: PAGE_TITLE,
  description:
    "SMS consent disclosure for Rapid Cortex: approved agency workflows, opt-out guidance, and public safety communications context.",
};

export default function SmsConsentPage() {
  return (
    <LegalDocShell title={PAGE_TITLE} lastUpdated="April 30, 2026">
      <section className="space-y-4 pb-8">
        <p>
          By providing a mobile number through Rapid Cortex forms or approved agency workflows, you consent to receive
          SMS messages related to demo scheduling, onboarding, account access, support, or authorized Rapid Cortex
          communications. Message and data rates may apply. Message frequency may vary. You may reply STOP to opt out or
          HELP for assistance where supported.
        </p>
        <p className="text-slate-400">
          SMS consent is not required to purchase Rapid Cortex services unless SMS-based communication is part of the
          approved agency workflow.
        </p>
        <p className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href={marketingPrivacyPath()} className="font-medium">
            Privacy
          </Link>
          <Link href={marketingTermsPath()} className="font-medium">
            Terms
          </Link>
          <Link href={marketingContactPath()} className="font-medium">
            Contact
          </Link>
        </p>
      </section>

      <p className="text-base font-medium text-slate-200">Rapid Cortex by Apps On Demand</p>
      <p className="text-xs text-slate-500">
        Operated by{" "}
        <a href={SITE_OPERATOR_URL} target="_blank" rel="noopener noreferrer" className="text-slate-400">
          {SITE_OPERATOR_NAME}
        </a>{" "}
        ({SITE_OPERATOR_URL.replace(/^https?:\/\//, "")}).
      </p>
      <p className="text-slate-400">
        This page documents how {SITE_NAME} supports{" "}
        <strong className="text-slate-300">dispatcher-initiated, incident-specific communication with 911/public safety callers</strong>{" "}
        via SMS. It is published as a public reference for toll-free number verification and carrier compliance.{" "}
        <Link href={marketingPrivacyPath()}>Privacy policy</Link> describes broader data practices.
      </p>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Purpose of SMS</h2>
        <p>
          {SITE_NAME} SMS is used only for <strong className="text-slate-200">dispatcher-initiated, incident-specific</strong>{" "}
          outreach tied to an active public safety contact. Recipients are individuals who have contacted 911 or another
          public safety communications center and are engaged in that incident context. Messages are not sent for
          marketing, promotions, advertising, or unsolicited outreach.
        </p>
        <p className="text-slate-400">
          This is not a mass-notification or public emergency alerting service. Use is limited to authorized agency
          workflows within {SITE_NAME} for the incident at hand.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">How consent is collected</h2>
        <p>
          <strong className="text-slate-200">Verbal consent during the active call:</strong> Before an SMS is sent, a
          trained public safety telecommunicator obtains the caller&apos;s (or other involved party&apos;s) agreement on
          the recorded or monitored voice channel, in line with agency policy and applicable law.
        </p>
        <p>
          <strong className="text-slate-200">Confirmation in {SITE_NAME}:</strong> Dispatchers record consent by
          confirming within the {SITE_NAME} application that the required verbal consent was obtained before the
          system sends the message. No message is sent from {SITE_NAME} for this workflow without that confirmation.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Dispatcher verbal consent script (example)</h2>
        <p className="text-slate-400">
          Agencies may adapt wording to policy; the script below reflects the intended meaning for toll-free and
          carrier disclosure.
        </p>
        <blockquote className="border-l-4 border-sky-500/70 bg-slate-900/60 px-4 py-3 text-slate-300 italic">
          &ldquo;I&apos;m going to send you a text message from our agency&apos;s number to help with{" "}
          <span className="not-italic text-slate-200">[state the incident-specific purpose—for example, a secure link to
          upload a photo or video, a link to clarify a location, or translation assistance]</span>. This text is only for
          this incident—not for marketing. Standard message and data rates may apply. Do you agree to receive this
          text?&rdquo;
        </blockquote>
        <p>
          The dispatcher proceeds only after an affirmative response (for example, &ldquo;yes,&rdquo; &ldquo;I
          agree,&rdquo; or equivalent) consistent with agency procedures.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">What SMS messages may include</h2>
        <p>Incident-related content may include, as appropriate to the situation:</p>
        <ul className="ml-4 list-disc space-y-2 text-slate-400">
          <li>Secure upload links for photos or video related to the active incident</li>
          <li>Location clarification links</li>
          <li>Translation or language-assistance links</li>
          <li>Incident-specific follow-up instructions</li>
          <li>Requests for information related to the active incident</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Consent records</h2>
        <p>
          When an agency uses {SITE_NAME} for this workflow, the platform is designed to support an auditable record
          aligned to agency operations. Depending on configuration, consent-related records may include fields such as:
        </p>
        <ul className="ml-4 list-disc space-y-2 text-slate-400">
          <li>Agency ID</li>
          <li>Dispatcher user ID</li>
          <li>Incident ID</li>
          <li>Caller phone number (E.164 or as stored per agency policy)</li>
          <li>Timestamp</li>
          <li>Message purpose (category or description tied to the incident)</li>
          <li>Consent confirmation (for example, dispatcher attestation that verbal consent was obtained)</li>
        </ul>
        <p className="text-slate-400">
          Exact fields and retention follow the agency&apos;s configuration, contract, and applicable law.{" "}
          <Link href={marketingPrivacyPath()}>Privacy policy</Link> describes personal data handling at a high level.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">STOP, HELP, and frequency</h2>
        <ul className="ml-4 list-disc space-y-2 text-slate-400">
          <li>
            <strong className="text-slate-200">STOP:</strong> Recipients may reply STOP to opt out of further SMS from
            that workflow where supported by the carrier and agency configuration. Reply STOP may not unsubscribe the
            caller from emergency voice service or other non-SMS channels.
          </li>
          <li>
            <strong className="text-slate-200">HELP:</strong> Recipients may reply HELP for a short explanation of the
            program or a support contact provided by the agency, when available.
          </li>
          <li>
            <strong className="text-slate-200">Frequency and rates:</strong> Message frequency varies with incident
            activity. <strong className="text-slate-300">Message and data rates may apply.</strong>
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">No sale of SMS consent for marketing</h2>
        <p>
          SMS consent obtained for this dispatcher-initiated, incident-specific workflow is{" "}
          <strong className="text-slate-200">not sold, rented, or shared for marketing purposes.</strong> Communications
          are limited to public safety incident workflows and authorized agency use of {SITE_NAME}.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Operator</h2>
        <p>
          {SITE_NAME} is offered by{" "}
          <a href={SITE_OPERATOR_URL} target="_blank" rel="noopener noreferrer">
            {SITE_OPERATOR_NAME}
          </a>
          . For questions about this disclosure, contact your agency administrator or reach us via the{" "}
          <Link href="/contact">contact</Link> page.
        </p>
      </section>
    </LegalDocShell>
  );
}
