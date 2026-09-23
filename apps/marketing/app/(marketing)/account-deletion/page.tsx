import Link from "next/link";
import type { Metadata } from "next";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { buildPublicPageMetadata } from "@/lib/seo";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Account deletion | Rapid Cortex",
  description: `How to request deletion of a ${SITE_NAME} user account from the Android app or by email.`,
  path: "/account-deletion",
});

const NAV = [
  { href: "#who", label: "Who this is for" },
  { href: "#how", label: "How to request" },
  { href: "#what", label: "What we delete" },
  { href: "#retain", label: "What we retain" },
] as const;

export default function AccountDeletionPage() {
  return (
    <LegalDocShell
      eyebrow="Legal"
      title="Account deletion"
      description={`How licensed ${SITE_NAME} users request deletion of their login and associated personal data. Google Play reviewers and Android users should use this page.`}
      lastReviewed="September 13, 2026"
      navItems={NAV}
      complianceNote="This page is publicly accessible without login for Google Play and privacy-policy review."
    >
      <p>
        {SITE_NAME} accounts are provisioned by an agency administrator. There is no public self-signup
        in the Android app. Licensed staff can still request deletion of their user account from{" "}
        <strong className="font-medium text-slate-200">Account → Request account deletion</strong> in
        the app, or by using the contacts below.
      </p>

      <section id="who" className="space-y-3">
        <h2 className="text-base font-semibold text-white">Who this is for</h2>
        <p>
          Venue, campus, and other Rapid Cortex staff who sign in with a work email on the Android
          app (<code className="text-slate-300">us.rapidcortex.app</code>).
        </p>
      </section>

      <section id="how" className="space-y-3">
        <h2 className="text-base font-semibold text-white">How to request</h2>
        <ol className="ml-4 list-decimal space-y-2 text-slate-400">
          <li>
            In the Android app, open <span className="text-slate-200">Account</span> and tap{" "}
            <span className="text-slate-200">Request account deletion</span> (this page).
          </li>
          <li>
            Email{" "}
            <a href="mailto:privacy@rapidcortex.us?subject=Rapid%20Cortex%20Android%20account%20deletion">
              privacy@rapidcortex.us
            </a>{" "}
            from the same work address used to sign in. Include the agency name if you know it.
          </li>
          <li>
            You may also write{" "}
            <a href="mailto:support@rapidcortex.us?subject=Account%20deletion">support@rapidcortex.us</a>{" "}
            or ask your agency administrator to disable the account.
          </li>
        </ol>
        <p>
          We acknowledge requests within 5 business days and complete deletion within 30 days unless a
          longer period is required by public-safety recordkeeping law.
        </p>
      </section>

      <section id="what" className="space-y-3">
        <h2 className="text-base font-semibold text-white">What we delete</h2>
        <ul className="ml-4 list-disc space-y-1 text-slate-400">
          <li>The Cognito login for that user (email, role mapping, refresh tokens).</li>
          <li>Device-local data (session, biometric preference) when the user signs out or uninstalls.</li>
          <li>Push tokens associated with that user, if any were ever stored.</li>
        </ul>
      </section>

      <section id="retain" className="space-y-3">
        <h2 className="text-base font-semibold text-white">What we retain</h2>
        <p>
          Agency operational records (location codes, NFC write logs, audit events) belong to the
          subscribing agency and are not removed solely because one staff login is deleted. Limited
          audit metadata may be retained for up to 7 years where required for public-safety
          recordkeeping. See the{" "}
          <Link href="/privacy#rights">Privacy policy — Your rights</Link> for DSAR details.
        </p>
      </section>
    </LegalDocShell>
  );
}
