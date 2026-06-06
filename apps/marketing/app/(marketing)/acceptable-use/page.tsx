import Link from "next/link";
import type { Metadata } from "next";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Acceptable Use Policy | Rapid Cortex Platform",
  description: `Review permitted and prohibited uses of the ${SITE_NAME} platform, APIs, and public properties for emergency communications and public safety operations.`,
  path: "/acceptable-use",
});

export default function AcceptableUsePage() {
  return (
    <LegalDocShell title="Acceptable use policy" lastUpdated="April 23, 2026">
      <p className="text-slate-400">
        This policy sets expectations for use of the {SITE_NAME} product, APIs, and customer-facing
        properties. It supplements your <Link href="/terms">Terms of use</Link> and any written agreement
        with your agency.
      </p>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Permitted use</h2>
        <p>
          Use the service only for lawful public-safety, emergency-communications, and training purposes
          authorized by your agency. Follow agency SOP, applicable law, and your credentials’ scope
          (dispatcher, supervisor, admin, etc.).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Prohibited conduct</h2>
        <p>You must not, and must not allow others to:</p>
        <ul className="ml-4 list-disc space-y-1 text-slate-400">
          <li>Interfere with or disrupt the service, other tenants, or underlying infrastructure.</li>
          <li>Probe, scan, or test vulnerabilities without a written, authorized engagement (pen test SOW).</li>
          <li>Mine data from the product for public resale, build competing datasets, or train unrelated AI models without a written addendum.</li>
          <li>Upload malware, or use the product to send spam, phishing, or harassing content.</li>
          <li>Circumvent access controls, exfiltrate data you are not authorized to access, or share credentials.</li>
          <li>Use the product in a way that violates 911, public safety, or privacy laws, or that could endanger the public or workforce.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Enforcement</h2>
        <p>
          We may suspend, throttle, or terminate access that appears to violate this policy, where
          contractually permitted, and will coordinate with your agency’s administrators when
          appropriate. Criminal activity will be reported to the relevant authorities.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Contact</h2>
        <p>
          Report abuse or questions to your agency’s {SITE_NAME} admin or, for security issues, the
          contact path defined in your security addendum. General inquiries:{" "}
          <a href="mailto:security@rapidcortex.us?subject=Acceptable%20use%20inquiry">security@rapidcortex.us</a>{" "}
          (or as listed in your order form).
        </p>
      </section>
    </LegalDocShell>
  );
}
