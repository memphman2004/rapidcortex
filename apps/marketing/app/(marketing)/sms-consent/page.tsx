import type { Metadata } from "next";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME, SITE_OPERATOR_NAME, SITE_OPERATOR_URL } from "@/lib/site";
import styles from "./sms-consent.module.css";

export const metadata: Metadata = {
  ...buildPublicPageMetadata({
    title: "SMS Consent & Messaging Disclosure — Rapid Cortex",
    description:
      "How Rapid Cortex collects consent and sends SMS messages on behalf of public safety agencies.",
    path: "/sms-consent",
  }),
  robots: { index: true, follow: true },
};

const NAV = [
  { href: "#platform-sms", label: "Platform SMS Consent" },
  { href: "#incident-sms", label: "Dispatcher-Initiated Incident SMS" },
  { href: "#consent-records", label: "Consent Records" },
  { href: "#optout", label: "STOP & HELP" },
  { href: "#no-marketing", label: "No Marketing Use" },
] as const;

/** Public, no-auth carrier / A2P disclosure under shared marketing chrome. */
export default function SmsConsentPage() {
  return (
    <LegalDocShell
      eyebrow="SMS Consent & Messaging Disclosure"
      title="How Rapid Cortex Sends Text Messages"
      description="This page covers two distinct SMS workflows: general platform communications, and dispatcher-initiated incident-specific messaging. Published as a public reference for carrier compliance and toll-free verification."
      lastReviewed="August 1, 2026"
      navItems={NAV}
      complianceNote="This page is publicly accessible without login for regulatory and carrier compliance review purposes."
    >
      <div className={styles.partHeader} id="platform-sms">
        <div className={`${styles.partEyebrow} ${styles.partEyebrowAmber}`}>
          Part 1 — Platform Communications
        </div>
        <h2>General Platform SMS Consent</h2>
        <p>
          SMS consent for Rapid Cortex platform users — demo scheduling, onboarding, account access,
          and support communications.
        </p>
      </div>

      <section className={styles.section} aria-labelledby="platform-sms">
        <div className={styles.generalConsentBox}>
          <p>
            By providing a mobile number through Rapid Cortex forms or approved agency workflows, you
            consent to receive SMS messages related to demo scheduling, onboarding, account access,
            support, or authorized Rapid Cortex communications.
          </p>
          <p>
            Message and data rates may apply. Message frequency may vary. You may reply{" "}
            <span className={styles.keyword}>STOP</span> to opt out or{" "}
            <span className={styles.keyword}>HELP</span> for assistance where supported.
          </p>
          <p>
            SMS consent is not required to purchase Rapid Cortex services unless SMS-based
            communication is part of the approved agency workflow.
          </p>
        </div>
      </section>

      <div className={styles.partHeader} id="incident-sms">
        <div className={`${styles.partEyebrow} ${styles.partEyebrowBlue}`}>
          Part 2 — Carrier &amp; Toll-Free Verification Reference
        </div>
        <h2>Dispatcher-Initiated, Incident-Specific SMS</h2>
        <p>
          How {SITE_NAME} supports dispatcher-initiated, incident-specific communication with 911 and
          public safety callers. Published as a public reference for toll-free number verification
          and carrier compliance.
        </p>
      </div>

      <section className={styles.section}>
        <h3>Purpose of SMS</h3>
        <p>
          Rapid Cortex SMS is used only for dispatcher-initiated, incident-specific outreach tied to
          an active public safety contact. Recipients are individuals who have contacted 911 or
          another public safety communications center and are engaged in that incident context.
          Messages are not sent for marketing, promotions, advertising, or unsolicited outreach.
        </p>
        <div className={styles.notice}>
          <strong>This is not a mass-notification or public emergency alerting service.</strong> Use
          is limited to authorized agency workflows within Rapid Cortex for the incident at hand.
        </div>
      </section>

      <section className={styles.section} id="consent">
        <h3>How Consent Is Collected</h3>

        <div className={styles.consentCard}>
          <div className={styles.cardLabel}>Step 1 — Verbal consent on the recorded call</div>
          <h4>Live, On-Call Verbal Agreement</h4>
          <p>
            Before an SMS is sent, a trained public safety telecommunicator obtains the caller&apos;s
            (or other involved party&apos;s) agreement on the recorded or monitored voice channel, in
            line with agency policy and applicable law.
          </p>
        </div>

        <div className={styles.consentCard}>
          <div className={styles.cardLabel}>Step 2 — Dispatcher confirmation in Rapid Cortex</div>
          <h4>Platform Attestation Before Send</h4>
          <p>
            Dispatchers record consent by confirming within the Rapid Cortex application that the
            required verbal consent was obtained before the system sends the message.{" "}
            <strong>
              No message is sent from Rapid Cortex for this workflow without that confirmation.
            </strong>
          </p>
        </div>

        <div className={styles.scriptBlock}>
          <div className={styles.scriptLabel}>Dispatcher Verbal Consent Script — Example</div>
          <blockquote>
            &ldquo;I&apos;m going to send you a text message from our agency&apos;s number to help
            with [state the incident-specific purpose — for example, a secure link to upload a photo
            or video, a link to clarify a location, or translation assistance]. This text is only for
            this incident — not for marketing. Standard message and data rates may apply. Do you
            agree to receive this text?&rdquo;
          </blockquote>
          <p className={styles.scriptNote}>
            Agencies may adapt wording to policy; the script above reflects the intended meaning for
            toll-free and carrier disclosure. The dispatcher proceeds only after an affirmative
            response (for example, &ldquo;yes,&rdquo; &ldquo;I agree,&rdquo; or equivalent)
            consistent with agency procedures.
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <h3>What SMS Messages May Include</h3>
        <p>Incident-related content may include, as appropriate to the situation:</p>
        <ul className={styles.bulletList}>
          <li>Secure upload links for photos or video related to the active incident</li>
          <li>Location clarification links</li>
          <li>Translation or language-assistance links</li>
          <li>Incident-specific follow-up instructions</li>
          <li>Requests for information related to the active incident</li>
        </ul>
      </section>

      <section className={styles.section} id="consent-records">
        <h3>Consent Records</h3>
        <p>
          When an agency uses Rapid Cortex for this workflow, the platform is designed to support an
          auditable record aligned to agency operations. Depending on configuration, consent-related
          records may include fields such as:
        </p>
        <table className={styles.recordTable}>
          <tbody>
            <tr>
              <td>Agency ID</td>
              <td>Identifies the public safety agency that initiated the workflow</td>
            </tr>
            <tr>
              <td>Dispatcher user ID</td>
              <td>The authenticated telecommunicator who attested verbal consent</td>
            </tr>
            <tr>
              <td>Incident ID</td>
              <td>Links the consent record to the active incident</td>
            </tr>
            <tr>
              <td>Caller phone number</td>
              <td>E.164 format or as stored per agency policy</td>
            </tr>
            <tr>
              <td>Timestamp</td>
              <td>Date and time of dispatcher attestation</td>
            </tr>
            <tr>
              <td>Message purpose</td>
              <td>Category or description tied to the incident</td>
            </tr>
            <tr>
              <td>Consent confirmation</td>
              <td>Dispatcher attestation that verbal consent was obtained</td>
            </tr>
          </tbody>
        </table>
        <p>
          Exact fields and retention follow the agency&apos;s configuration, contract, and applicable
          law. The <a href="/privacy">privacy policy</a> describes personal data handling at a high
          level.
        </p>
      </section>

      <section className={styles.section} id="optout">
        <h3>STOP, HELP, and Frequency</h3>
        <table className={styles.recordTable}>
          <tbody>
            <tr>
              <td>
                <span className={styles.keyword}>STOP</span>
              </td>
              <td>
                Recipients may reply STOP to opt out of further SMS from that workflow where supported
                by the carrier and agency configuration. Reply STOP may not unsubscribe the caller
                from emergency voice service or other non-SMS channels.
              </td>
            </tr>
            <tr>
              <td>
                <span className={styles.keyword}>HELP</span>
              </td>
              <td>
                Recipients may reply HELP for a short explanation of the program or a support contact
                provided by the agency, when available.
              </td>
            </tr>
            <tr>
              <td>Frequency &amp; rates</td>
              <td>
                Message frequency varies with incident activity. Message and data rates may apply.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section} id="no-marketing">
        <h3>No Sale of SMS Consent for Marketing</h3>
        <p>
          We do not share, sell, or provide your mobile phone number or messaging consent data to
          third parties or affiliates for marketing or promotional purposes. SMS consent obtained for
          this dispatcher-initiated, incident-specific workflow is used only to deliver
          incident-related messages and operate the service. Communications are limited to public
          safety incident workflows and authorized agency use of Rapid Cortex.
        </p>
      </section>

      <section className={styles.section}>
        <h3>Operator</h3>
        <p>
          Rapid Cortex is offered by {SITE_OPERATOR_NAME}. For questions about this disclosure,
          contact your agency administrator or reach us via the contact page.
        </p>
        <div className={styles.operatorBox}>
          Rapid Cortex by Apps On Demand — operated by{" "}
          <a href={SITE_OPERATOR_URL} target="_blank" rel="noopener noreferrer">
            Apps on Demand (www.appsondemand.net)
          </a>
        </div>
        <div className={styles.policyRow}>
          <a className={styles.policyLink} href="/privacy">
            Privacy Policy
          </a>
          <a className={styles.policyLink} href="/terms">
            Terms of Use
          </a>
          <a className={styles.policyLink} href="/contact-sales">
            Contact
          </a>
        </div>
      </section>
    </LegalDocShell>
  );
}
