import Link from "next/link";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { SITE_NAME, SITE_OPERATOR_NAME, SITE_OPERATOR_URL } from "@/lib/site";

export const metadata = {
  title: "Terms of use",
  description: `Terms governing use of the ${SITE_NAME} product and public websites.`,
};

export default function TermsOfUsePage() {
  return (
    <LegalDocShell title="Terms of use" lastReviewed="August 1, 2026">
      <p className="text-slate-400">
        These terms govern access to the {SITE_NAME} websites and, together with an order form or
        statement of work, the use of the software service. A signed agreement with your agency takes
        precedence where it explicitly differs.
      </p>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">The service</h2>
        <p>
          {SITE_NAME} provides decision-support, workflow, and related capabilities for public-safety and
          emergency-communications use cases, subject to the features and limits described in your
          subscription or pilot. The service is assistive; agencies remain responsible for dispatch
          actions, 911, CAD, and compliance with law and policy.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Accounts and access</h2>
        <p>
          You are responsible for credentials issued to your organization. You will not share accounts,
          attempt to access data outside your authorized scope, or use the product in a way that violates
          law, our <Link href="/acceptable-use">Acceptable use policy</Link>, or your agency’s rules.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Acceptable use</h2>
        <p>
          You agree to the restrictions in the <Link href="/acceptable-use">Acceptable use policy</Link>{" "}
          (no misuse, no interference with the service, no unlawful surveillance, etc.).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Intellectual property</h2>
        <p>
          {SITE_NAME} and related marks, software, and content are protected by law. We grant you a
          limited, non-exclusive right to use the service as authorized in your order. You retain rights
          in your data; you grant us a license to host and process that data to operate the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Warranty disclaimer</h2>
        <p>
          The service is provided <span className="italic">as is</span> and <span className="italic">as available</span>{" "}
          to the maximum extent permitted by law. We disclaim implied warranties of merchantability,
          fitness for a particular purpose, and non-infringement, except where prohibited.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, neither {SITE_NAME} nor {SITE_OPERATOR_NAME} is liable
          for indirect, incidental, special, consequential, or punitive damages, or for loss of life,
          health, or property arising from use of the service. Direct damages are limited to fees paid in
          the twelve months before the event giving rise to the claim, unless your master agreement
          states otherwise.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Indemnity</h2>
        <p>
          You will defend and indemnify us against third-party claims arising from your use of the
          service, your data, or your violation of these terms, subject to the carve-outs and caps in
          your written agreement, if any.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Governing law and venue</h2>
        <p>
          For customers without a negotiated governing-law clause, disputes are subject to the laws of
          the State of Ohio, USA, and exclusive jurisdiction in courts located there, without regard to
          conflict-of-law rules. Your order form may replace this section.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Rapid Cortex SMS messaging program</h2>
        <p>
          <strong className="font-medium text-slate-200">Program name:</strong> Rapid Cortex SMS
          (including Rapid Cortex Connect), operated by {SITE_OPERATOR_NAME} LLC d/b/a {SITE_NAME} (
          <a href="https://www.rapidcortex.us">https://www.rapidcortex.us</a>).
        </p>
        <p>
          <strong className="font-medium text-slate-200">Program description:</strong> {SITE_NAME}{" "}
          sends transactional SMS related to public-safety workflows. This includes (1) one-time camera
          consent requests to property owners who enrolled an eligible Ring™ or Nest™ device in Rapid
          Cortex Connect, when a participating agency requests temporary live camera access for a nearby
          active emergency; and (2) dispatcher-initiated, incident-specific texts to individuals who
          contacted 911 or another public safety communications center and agreed on that call to receive
          a text for the active incident (for example, a secure media upload, location clarification, or
          language-assistance link). Messages are not used for marketing, advertising, promotions, or mass
          public alerting.
        </p>
        <p>
          <strong className="font-medium text-slate-200">Message frequency:</strong> Message frequency
          varies. Texts are incident-triggered and typically infrequent; enrolled device owners or
          consented callers may receive zero messages unless an authorized workflow requires one.
        </p>
        <p>
          <strong className="font-medium text-slate-200">Message and data rates:</strong> Message and
          data rates may apply. Carrier charges are the recipient&apos;s responsibility under their
          wireless plan.
        </p>
        <p>
          <strong className="font-medium text-slate-200">Opt-out and help:</strong> Reply{" "}
          <strong>STOP</strong> to opt out of further SMS from this program. Reply <strong>HELP</strong>{" "}
          for help. Opting out of SMS does not cancel 911 voice service or other non-SMS emergency
          channels. Additional consent and disclosure details are published at{" "}
          <Link href="/sms-consent">https://www.rapidcortex.us/sms-consent</Link>. Mobile numbers and SMS
          consent are handled as described in our <Link href="/privacy">Privacy policy</Link>.
        </p>
        <p>
          <strong className="font-medium text-slate-200">Support contact:</strong>{" "}
          <a href="mailto:support@rapidcortex.us?subject=SMS%20program%20help">support@rapidcortex.us</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Contact</h2>
        <p>
          <a href={SITE_OPERATOR_URL} target="_blank" rel="noopener noreferrer">
            {SITE_OPERATOR_NAME}
          </a>{" "}
          supports site operations. Product and contracting questions should follow the channel in your
          order documentation. For SMS program support, use the contacts listed under Rapid Cortex SMS
          messaging program above.
        </p>
      </section>
    </LegalDocShell>
  );
}
