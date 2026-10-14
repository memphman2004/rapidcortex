import type { Metadata } from "next";
import { BusinessSmsOptInForm } from "@/components/marketing/business-sms-opt-in-form";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME, SITE_OPERATOR_NAME, SITE_OPERATOR_URL } from "@/lib/site";
import styles from "./sms-consent.module.css";

export const metadata: Metadata = {
  ...buildPublicPageMetadata({
    title: "SMS Consent & Messaging Disclosure — NexCort iQ",
    description:
      "How NexCort iQ collects consent for business communications SMS and public-safety incident messaging.",
    path: "/sms-consent",
  }),
  robots: { index: true, follow: true },
};

const NAV = [
  { href: "#platform-sms", label: "Platform SMS Consent" },
  { href: "#business-sms", label: "Business Communications SMS" },
  { href: "#opt-in-form", label: "SMS Opt-In Form" },
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
      title="How NexCort iQ Sends Text Messages"
      description="This page covers three distinct SMS workflows: general platform communications, one-to-one Business Communications SMS with customers and prospects who opt in, and dispatcher-initiated incident-specific messaging. Published as a public reference for carrier compliance, Microsoft messaging campaigns, and toll-free verification."
      lastReviewed="October 13, 2026"
      navItems={NAV}
      complianceNote="This page is publicly accessible without login for regulatory and carrier compliance review purposes."
    >
      <div className={styles.partHeader} id="platform-sms">
        <div className={`${styles.partEyebrow} ${styles.partEyebrowAmber}`}>
          Part 1 — Platform Communications
        </div>
        <h2>General Platform SMS Consent</h2>
        <p>
          SMS consent for NexCort iQ platform users — onboarding, account access, and support
          communications under approved agency or product workflows. Business sales texting is
          described separately below and requires an explicit, non-default opt-in.
        </p>
      </div>

      <section className={styles.section} aria-labelledby="platform-sms">
        <div className={styles.generalConsentBox}>
          <p>
            By providing a mobile number through NexCort iQ forms or approved agency workflows and
            completing any required SMS consent step for that workflow, you may receive SMS messages
            related to onboarding, account access, support, or other authorized NexCort iQ
            communications for that program.
          </p>
          <p>
            Message and data rates may apply. Message frequency may vary. You may reply{" "}
            <span className={styles.keyword}>STOP</span> to opt out or{" "}
            <span className={styles.keyword}>HELP</span> for assistance where supported.
          </p>
          <p>
            SMS consent is not required to purchase NexCort iQ services unless SMS-based
            communication is part of the approved agency workflow. Providing a telephone number alone
            does not constitute consent to receive Business Communications SMS.
          </p>
        </div>
      </section>

      <section className={styles.section} id="business-sms" aria-labelledby="business-sms-heading">
        <h3 id="business-sms-heading">NexCort iQ Business Communications SMS Program</h3>
        <p>
          <strong>Program Operator:</strong> Apps On Demand LLC, doing business as NexCort iQ.
        </p>

        <h4 className={styles.subhead}>Program Purpose</h4>
        <p>
          NexCort iQ provides optional, one-to-one SMS communications between authorized NexCort iQ
          representatives (including sales advisors) and customers or prospective customers who have
          expressly agreed to receive text messages.
        </p>
        <p>Messages may include:</p>
        <ul className={styles.bulletList}>
          <li>Responses to customer inquiries and requests for product information.</li>
          <li>Product demonstration scheduling and confirmations.</li>
          <li>Meeting reminders and appointment updates.</li>
          <li>Requested follow-up information regarding NexCort iQ solutions.</li>
          <li>Customer service, onboarding, and support communications.</li>
        </ul>
        <p>
          This SMS program is not used for unsolicited advertising, bulk marketing, purchased contact
          lists, or automated sales campaigns.
        </p>

        <h4 className={styles.subhead}>How Customers Opt In</h4>
        <p>
          Customers and prospective customers may voluntarily consent to SMS communications when
          completing the public inquiry form on this page (
          <a href="https://www.nexcortiq.us/sms-consent/#opt-in-form">
            https://www.nexcortiq.us/sms-consent/#opt-in-form
          </a>
          ), or when completing a NexCort iQ contact or demonstration-request form on{" "}
          <a href="https://www.nexcortiq.us">nexcortiq.us</a>.
        </p>
        <p>
          The SMS consent option is a separate checkbox below the form. It is not selected by
          default. Submitting a form without checking the box does not enroll the submitter in
          Business Communications SMS.
        </p>
        <p>
          Customers may also provide express consent during an individual conversation with a NexCort
          iQ representative, when that consent is appropriately documented (for example, written
          confirmation or a recorded affirmation consistent with internal sales process).
        </p>
        <p>
          Providing a telephone number alone does not constitute consent to receive SMS messages.
          NexCort iQ does not send Business Communications SMS unless consent was obtained through an
          appropriate process described on this page. Submitting the form does not automatically send
          an SMS.
        </p>

        <div className={styles.optInFormBlock} id="opt-in-form">
          <h4 className={styles.connectTitle} id="opt-in-form-heading">
            Connect with NexCort iQ
          </h4>
          <p className={styles.connectLead}>Let&apos;s start a conversation.</p>
          <p>
            Interested in learning how NexCort iQ can enhance safety, security, and emergency
            response for your organization?
          </p>
          <p>
            Complete the form below to request more information, schedule a demonstration, or connect
            with a NexCort iQ representative.
          </p>
          <p>
            If you&apos;d prefer to communicate by text, you can also opt in to receive SMS updates
            and follow-up messages from our team.
          </p>
          <BusinessSmsOptInForm />
        </div>

        <h4 className={styles.subhead}>How Consent Is Recorded</h4>
        <p>
          When a visitor opts in on this page, the contact form, or the demo-request form, NexCort iQ
          records at minimum: consent status (opted in), timestamp, disclosure version for this
          program, form source (<code>sms-consent</code>, <code>contact-sales</code>, or{" "}
          <code>demo</code>), and the associated mobile phone number. Sales advisors must not use
          Business Communications SMS for that contact unless a qualifying consent record exists or
          documented conversational consent was obtained.
        </p>

        <h4 className={styles.subhead}>Messaging Terms and Conditions</h4>
        <ul className={styles.bulletList}>
          <li>
            <strong>Program name:</strong> NexCort iQ Business Communications SMS.
          </li>
          <li>
            <strong>Message frequency:</strong> Varies depending on customer inquiries and ongoing
            conversations.
          </li>
          <li>
            <strong>Message and data rates:</strong> Carrier message and data rates may apply.
          </li>
          <li>
            <strong>Opt-out:</strong> Reply <span className={styles.keyword}>STOP</span> to
            discontinue SMS communications.
          </li>
          <li>
            <strong>Help:</strong> Reply <span className={styles.keyword}>HELP</span> for assistance
            or email{" "}
            <a href="mailto:support@nexcortiq.us">support@nexcortiq.us</a>.
          </li>
          <li>
            <strong>Consent:</strong> Consent to receive SMS messages is voluntary and is not a
            condition of purchase.
          </li>
          <li>
            <strong>Message content:</strong> Limited to requested business communications,
            appointment coordination, and customer support.
          </li>
          <li>
            <strong>Delivery:</strong> Message delivery is subject to carrier availability and is not
            guaranteed.
          </li>
        </ul>

        <h4 className={styles.subhead}>SMS Privacy Protection</h4>
        <p>
          NexCort iQ does not share, sell, rent, or disclose mobile phone numbers or SMS opt-in and
          consent information to third parties or affiliates for marketing or promotional purposes.
        </p>
        <p>
          SMS service providers may process mobile numbers and message data only as necessary to
          deliver and support the messaging service.
        </p>

        <h4 className={styles.subhead}>Additional Information</h4>
        <ul className={styles.bulletList}>
          <li>
            Terms and Conditions:{" "}
            <a href="https://www.nexcortiq.us/terms">https://www.nexcortiq.us/terms</a>
          </li>
          <li>
            Privacy Policy:{" "}
            <a href="https://www.nexcortiq.us/privacy/">https://www.nexcortiq.us/privacy/</a>
          </li>
          <li>
            SMS Consent and Messaging Disclosure:{" "}
            <a href="https://www.nexcortiq.us/sms-consent/">
              https://www.nexcortiq.us/sms-consent/
            </a>
          </li>
          <li>
            Contact: <a href="mailto:support@nexcortiq.us">support@nexcortiq.us</a>
          </li>
        </ul>
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
          NexCort iQ SMS is used only for dispatcher-initiated, incident-specific outreach tied to
          an active public safety contact. Recipients are individuals who have contacted 911 or
          another public safety communications center and are engaged in that incident context.
          Messages are not sent for marketing, promotions, advertising, or unsolicited outreach.
        </p>
        <div className={styles.notice}>
          <strong>This is not a mass-notification or public emergency alerting service.</strong> Use
          is limited to authorized agency workflows within NexCort iQ for the incident at hand.
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
          <div className={styles.cardLabel}>Step 2 — Dispatcher confirmation in NexCort iQ</div>
          <h4>Platform Attestation Before Send</h4>
          <p>
            Dispatchers record consent by confirming within the NexCort iQ application that the
            required verbal consent was obtained before the system sends the message.{" "}
            <strong>
              No message is sent from NexCort iQ for this workflow without that confirmation.
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
          When an agency uses NexCort iQ for this workflow, the platform is designed to support an
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
          Business Communications SMS is used only for one-to-one business, appointment, and support
          texts with consented contacts. SMS consent obtained for dispatcher-initiated,
          incident-specific workflows is used only to deliver incident-related messages and operate
          the service. Communications are limited to those authorized programs and agency use of
          NexCort iQ.
        </p>
      </section>

      <section className={styles.section}>
        <h3>Operator</h3>
        <p>
          NexCort iQ is offered by {SITE_OPERATOR_NAME}. For questions about this disclosure,
          contact your agency administrator or reach us via the contact page.
        </p>
        <div className={styles.operatorBox}>
          NexCort iQ by Apps On Demand — operated by{" "}
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
