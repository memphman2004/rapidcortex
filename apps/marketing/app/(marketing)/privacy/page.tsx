import Link from "next/link";
import type { Metadata } from "next";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Privacy Policy | Rapid Cortex Public Safety Platform",
  description: `Learn how ${SITE_NAME} manages personal and operational information for public safety agencies, emergency communications teams, and platform users.`,
  path: "/privacy",
});

const PRIVACY_NAV = [
  { href: "#sms-consent", label: "SMS & messaging" },
  { href: "#sharing", label: "Sharing" },
  { href: "#ai-training", label: "AI training" },
  { href: "#retention", label: "Retention" },
  { href: "#sms", label: "SMS program" },
  { href: "#ring", label: "Ring integration" },
  { href: "#rights", label: "Your rights" },
  { href: "#changes", label: "Changes" },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <LegalDocShell
      eyebrow="Legal"
      title="Privacy policy"
      description={`How ${SITE_NAME} and its operators collect, use, and protect information for public safety agencies, emergency communications teams, and platform users.`}
      lastReviewed="August 23, 2026"
      navItems={PRIVACY_NAV}
      complianceNote="This page is publicly accessible without login for regulatory and carrier compliance review purposes."
    >
      <p>
        This policy describes how {SITE_NAME} and its operators collect, use, and protect information
        in connection with the product and marketing sites. It is not a substitute for your agency’s
        own privacy program, public records rules, or counsel review. For A2P 10DLC and SMS compliance,
        this page at{" "}
        <a href="https://www.rapidcortex.us/privacy">https://www.rapidcortex.us/privacy</a> is the
        single controlling privacy policy for Apps on Demand LLC d/b/a Rapid Cortex. See also the{" "}
        <Link href="/sms-consent">SMS Consent</Link> disclosure.
      </p>

      <section id="sms-consent" className="space-y-3 rounded-lg border border-sky-800/40 bg-sky-950/20 p-4">
        <h2 className="text-base font-semibold text-white">
          Mobile numbers and messaging consent — no marketing sharing
        </h2>
        <p>
          <strong className="font-medium text-slate-100">
            We do not share, sell, or provide your mobile phone number or messaging consent data to
            third parties or affiliates for marketing or promotional purposes.
          </strong>
        </p>
        <p className="text-slate-400">
          Mobile phone numbers and SMS opt-in/consent data collected for the Rapid Cortex SMS messaging
          program (including Rapid Cortex Connect camera-consent texts and dispatcher-initiated incident
          texts) are used only to deliver those transactional messages, honor STOP/HELP requests, and
          operate, secure, and audit the service. Message frequency varies.{" "}
          <strong className="font-medium text-slate-200">Message and data rates may apply.</strong> Reply{" "}
          <strong className="font-medium text-slate-200">STOP</strong> to opt out or{" "}
          <strong className="font-medium text-slate-200">HELP</strong> for help (
          <a href="mailto:support@rapidcortex.us">support@rapidcortex.us</a>).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Who this applies to</h2>
        <p>
          Visitors to our public website, account holders, agency personnel who access the operational application on
          behalf of a municipality, PSAP, or regional center, and Ring™ Device Owners who enroll in Rapid Cortex Connect
          through the Ring™ Appstore.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Information we may collect</h2>
        <ul className="ml-4 list-disc space-y-1 text-slate-400">
          <li>
            <span className="text-slate-300">Account and contact data:</span> name, work email, agency
            identifier, and role, provided during onboarding or sign-in.
          </li>
          <li>
            <span className="text-slate-300">Mobile and SMS data:</span> mobile phone numbers, SMS
            opt-in/opt-out status, message delivery metadata, and consent records related to Rapid Cortex
            SMS programs (including Rapid Cortex Connect camera-consent texts and dispatcher-initiated
            incident texts).
          </li>
          <li>
            <span className="text-slate-300">Service and product data:</span> operational content you
            generate in the application (for example, incident records, transcript segments, and related
            metadata) in accordance with your deployment and contract.
          </li>
          <li>
            <span className="text-slate-300">Technical data:</span> device/browser type, general
            location from IP, logs, and cookies as described in our{" "}
            <Link href="/cookies">Cookie policy</Link>.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">How we use information</h2>
        <p>
          To provide, secure, and improve the service; authenticate users; support agencies under
          contract; deliver transactional SMS related to enrolled camera-consent requests or active
          public-safety incidents; meet legal and safety obligations; and communicate with you about the
          product. We do not sell personal information. We do not use SMS consent or mobile numbers for
          marketing, advertising, or promotional campaigns.
        </p>
      </section>

      <section id="sharing" className="space-y-3">
        <h2 className="text-base font-semibold text-white">Sharing</h2>
        <p>
          We use infrastructure and subprocessors appropriate to a cloud-hosted emergency-communications
          product (for example, identity, hosting, SMS delivery, and email delivery). We may disclose
          account or operational data when required by law, to protect life and safety, or as directed by
          a valid agency agreement. Those disclosures do not include selling or providing mobile numbers or
          messaging consent for marketing. Cross-border transfers, if any, follow the safeguards in your
          order form or addendum.
        </p>
        <p>
          <strong className="font-medium text-slate-200">
            We do not share, sell, or provide your mobile phone number or messaging consent data to
            third parties or affiliates for marketing or promotional purposes.
          </strong>{" "}
          Infrastructure and subprocessors (for example SMS delivery providers) process messages only to
          operate the service — not for their own marketing. Mobile numbers and SMS consent are not sold,
          rented, or shared with third parties, affiliates, or lead generators for marketing or promotional
          purposes.
        </p>
        <p>
          Rapid Cortex shares data with the following categories of sub-processors to deliver the
          service:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-slate-400">
          <li>
            <span className="text-slate-300">Infrastructure:</span> Amazon Web Services (AWS) — hosting,
            storage, and compute
          </li>
          <li>
            <span className="text-slate-300">Communications:</span> Twilio Inc. — SMS and voice messaging
          </li>
          <li>
            <span className="text-slate-300">Camera integration:</span> Ring LLC (Amazon) — device
            authorization and live video streaming, solely pursuant to user consent
          </li>
          <li>
            <span className="text-slate-300">AI processing:</span> Anthropic PBC — natural language
            processing and transcription analysis under a data processing agreement
          </li>
        </ul>
        <p>
          Rapid Cortex does not sell, rent, or share personal data with third parties for advertising,
          marketing, or any purpose other than delivering the contracted services. A complete list of
          sub-processors is published at{" "}
          <Link href="/legal/sub-processors">rapidcortex.us/legal/sub-processors/</Link>.
        </p>
      </section>

      <section id="sms" className="space-y-3">
        <h2 className="text-base font-semibold text-white">SMS and mobile messaging</h2>
        <p>
          Rapid Cortex (operated by Apps on Demand LLC) may send transactional SMS under the{" "}
          <strong className="font-medium text-slate-200">Rapid Cortex SMS</strong> messaging program,
          including Rapid Cortex Connect camera-consent requests to enrolled Ring™ or Nest™ device owners
          and dispatcher-initiated, incident-specific texts authorized by a participating public safety
          agency. Message frequency varies based on incident activity and enrolled-device proximity; many
          recipients will receive no messages unless a nearby emergency or authorized workflow requires
          one. <strong className="font-medium text-slate-200">Message and data rates may apply.</strong>
        </p>
        <p>
          You may reply <strong className="font-medium text-slate-200">STOP</strong> to opt out of further
          SMS from that program, or <strong className="font-medium text-slate-200">HELP</strong> for
          assistance. Support:{" "}
          <a href="mailto:support@rapidcortex.us?subject=SMS%20help">support@rapidcortex.us</a>.
          Additional program details appear in our <Link href="/terms">Terms of use</Link> and on the{" "}
          <Link href="/sms-consent">SMS Consent</Link> page.
        </p>
      </section>

      <section id="ring" className="space-y-3">
        <h2 className="text-base font-semibold text-white">Ring™ integration and live video handling</h2>
        <p>
          For Ring™-connected workflows (Rapid Cortex Connect), Rapid Cortex is designed for live operational viewing
          only. We do not record, retain, or store Ring™ video in Rapid Cortex systems (retention period: 0 days).{" "}
          <strong className="font-medium text-slate-200">Ring™ Device Owners</strong> enroll by enabling Rapid Cortex
          Connect in the Ring™ Appstore and completing device-owner sign-in when Ring™ shows Pending. Linking uses
          Ring™&apos;s Appstore / OAuth authorization and can be revoked anytime in Ring™ (for example My Apps). When a
          participating agency requests temporary camera access for a nearby incident, the Ring™ Device Owner is
          contacted by SMS and must tap Allow before any live view begins; Decline and Stop Sharing remain available.
        </p>
      </section>

      <section id="retention" className="space-y-3">
        <h2 className="text-base font-semibold text-white">Data retention</h2>
        <p>
          Incident and call data is retained for the duration of the agency&apos;s active subscription
          plus 90 days following contract termination, after which it is permanently deleted. Ring
          camera access tokens are deleted immediately upon account unlinking or subscription
          termination. Audit logs are retained for 7 years in compliance with public safety
          recordkeeping requirements. Users may request data deletion by contacting{" "}
          <a href="mailto:privacy@rapidcortex.us">privacy@rapidcortex.us</a>.
        </p>
        <p>
          Ring™ video is not stored in Rapid Cortex systems (retention period: 0 days). Control of Ring™
          video history remains with Ring™ and the Ring™ Device Owner.
        </p>
      </section>

      <section id="rights" className="space-y-3">
        <h2 className="text-base font-semibold text-white">Your rights and choices</h2>
        <p>
          Depending on your location and role, you may have rights to access, correct, export, or delete
          certain information. Many requests for operational records are handled through your agency
          administrator. For general privacy questions, contact us at{" "}
          <a href="mailto:privacy@rapidcortex.us?subject=Privacy%20inquiry">privacy@rapidcortex.us</a>{" "}
          (or the address in your order documentation).
        </p>
        <p>
          Data Subject Access Requests (DSAR) and deletion requests can also be submitted to{" "}
          <a href="mailto:support@rapidcortex.us?subject=Privacy%20request">support@rapidcortex.us</a>. We acknowledge
          requests within 5 business days and target fulfillment within 30 days. DSAR responses include data held in
          Rapid Cortex systems for the requestor; Ring™ video is not included because it is not stored by Rapid Cortex.
        </p>
        <p>
          Account deletion requests are processed within 30 days. Agencies may request deletion through their
          administrator workflows or via support, and individual users may request deletion through support. Where
          required by contract or law, limited audit metadata may be retained for compliance.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Consent, opt-out, and withdrawal</h2>
        <p>
          Ring™ Device Owners manage enrollment through the Ring™ Appstore and may disconnect Rapid Cortex Connect in
          Ring™ at any time. Per-incident video sharing requires a separate Allow on each SMS request; owners may
          Decline or Stop Sharing without disconnecting the app. Agency users provide consent through account
          onboarding terms and can opt out of non-essential data processing through account settings or support
          channels.
        </p>
        <p>
          When consent is withdrawn or sharing is stopped, connected access tokens are invalidated where applicable,
          active access sessions are terminated, and no further live camera access is permitted.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Human access and user controls</h2>
        <p>
          Authorized agency operators may view live operational data, including live camera streams when enabled for an
          incident workflow. Rapid Cortex support or security personnel may access limited customer data only when
          necessary for troubleshooting, incident response, legal compliance, or approved support requests.
        </p>
        <p>
          Users can review and manage data through role-based application interfaces, agency administration controls,
          and support-assisted exports/deletions where applicable. For Ring™ integrations specifically, control of video
          history and footage remains with Ring™ and the Ring™ Device Owner.
        </p>
      </section>

      <section id="ai-training" className="space-y-3">
        <h2 className="text-base font-semibold text-white">
          Use of customer data for AI model training
        </h2>
        <p>
          Rapid Cortex does not use customer data, incident data, call recordings, transcripts, or any
          personally identifiable information to train, fine-tune, or develop AI or machine learning
          models. AI functionality within Rapid Cortex is provided by third-party AI providers operating
          under data processing agreements that explicitly prohibit the use of customer data for model
          training purposes.
        </p>
        <p>
          We communicate material AI capability updates (including new features, quality/accuracy changes, and
          detection enhancements) through product release notes, in-app notices, and direct agency communications as
          appropriate.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Children</h2>
        <p>
          {SITE_NAME} is not intended for use by children as consumers of the product. The service is
          provided to agencies and their authorized workforce.
        </p>
      </section>

      <section id="changes" className="space-y-3">
        <h2 className="text-base font-semibold text-white">Changes</h2>
        <p>
          We may update this policy and will adjust the &quot;Last reviewed&quot; date. Material changes
          may be announced through the product, email, or the website as appropriate.
        </p>
      </section>
    </LegalDocShell>
  );
}
