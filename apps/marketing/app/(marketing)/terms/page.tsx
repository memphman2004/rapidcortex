import Link from "next/link";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { SITE_NAME, SITE_OPERATOR_NAME, SITE_OPERATOR_URL } from "@/lib/site";

export const metadata = {
  title: "Terms of use",
  description: `Terms governing use of the ${SITE_NAME} product and public websites.`,
};

export default function TermsOfUsePage() {
  return (
    <LegalDocShell title="Terms of use" lastUpdated="April 23, 2026">
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
        <h2 className="text-base font-semibold text-white">Contact</h2>
        <p>
          <a href={SITE_OPERATOR_URL} target="_blank" rel="noopener noreferrer">
            {SITE_OPERATOR_NAME}
          </a>{" "}
          supports site operations. Product and contracting questions should follow the channel in your
          order documentation.
        </p>
      </section>
    </LegalDocShell>
  );
}
