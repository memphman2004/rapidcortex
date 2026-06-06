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

export default function PrivacyPolicyPage() {
  return (
    <LegalDocShell title="Privacy policy" lastUpdated="June 1, 2026">
      <p className="text-slate-400">
        This policy describes how {SITE_NAME} and its operators collect, use, and protect information
        in connection with the product and marketing sites. It is not a substitute for your agency’s
        own privacy program, public records rules, or counsel review.
      </p>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Who this applies to</h2>
        <p>
          Visitors to our public website, account holders, and agency personnel who access the
          operational application on behalf of a municipality, PSAP, or regional center.
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
          contract; meet legal and safety obligations; and communicate with you about the product. We do
          not sell personal information.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Sharing</h2>
        <p>
          We use infrastructure and subprocessors appropriate to a cloud-hosted emergency-communications
          product (for example, identity, hosting, and email delivery). We share data when required by law,
          to protect life and safety, or as directed by a valid agency agreement. Cross-border transfers,
          if any, follow the safeguards in your order form or addendum.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Ring integration and live video handling</h2>
        <p>
          For Ring-connected workflows, Rapid Cortex is designed for live operational viewing only. We do not record,
          retain, or store Ring video in Rapid Cortex systems (retention period: 0 days). Camera-owner consent is
          obtained through Ring&apos;s standard OAuth authorization flow and can be revoked at any time in the Ring
          application. When a law-enforcement request requires owner action, the camera owner is contacted directly
          through Ring processes.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Retention</h2>
        <p>
          We retain data as long as needed to provide the service and meet contractual and legal
          obligations, including your agency’s retention and audit settings where configured.
        </p>
      </section>

      <section className="space-y-3">
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
          Rapid Cortex systems for the requestor; Ring video is not included because it is not stored by Rapid Cortex.
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
          Ring camera owners manage consent through Ring OAuth and may withdraw consent by revoking authorization in
          Ring. Agency users provide consent through account onboarding terms and can opt out of non-essential data
          processing through account settings or support channels.
        </p>
        <p>
          When consent is withdrawn, connected access tokens are invalidated, active access sessions are terminated,
          and no further live camera access is permitted.
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
          and support-assisted exports/deletions where applicable. For Ring integrations specifically, control of video
          history and footage remains with Ring and the camera owner.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">AI updates and training choices</h2>
        <p>
          We communicate material AI capability updates (including new features, quality/accuracy changes, and
          detection enhancements) through product release notes, in-app notices, and direct agency communications as
          appropriate.
        </p>
        <p>
          If an agency opts out of eligible data usage for model training or product improvement workflows, core
          contracted service functionality remains available, but certain improvement-driven capabilities may progress
          more slowly for that deployment.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Children</h2>
        <p>
          {SITE_NAME} is not intended for use by children as consumers of the product. The service is
          provided to agencies and their authorized workforce.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Changes</h2>
        <p>
          We may update this policy and will adjust the &quot;Last updated&quot; date. Material changes
          may be announced through the product, email, or the website as appropriate.
        </p>
      </section>
    </LegalDocShell>
  );
}
