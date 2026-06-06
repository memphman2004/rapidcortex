import Link from "next/link";
import { LegalDocShell } from "@/components/marketing/legal-doc-shell";
import { SITE_NAME } from "@/lib/site";

export const metadata = {
  title: "Cookie policy",
  description: `How ${SITE_NAME} uses cookies and similar technologies on the website and in the app.`,
};

export default function CookiePolicyPage() {
  return (
    <LegalDocShell title="Cookie policy" lastUpdated="April 23, 2026">
      <p className="text-slate-400">
        This policy explains how {SITE_NAME} and its hosting providers use cookies and similar
        technologies. For personal data more broadly, see our <Link href="/privacy">Privacy policy</Link>.
      </p>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">What are cookies?</h2>
        <p>
          Cookies are small text files placed on your device. We also use local storage, session
          storage, and similar tools where needed for sign-in, preferences, and security.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">How we use them</h2>
        <ul className="ml-4 list-disc space-y-1 text-slate-400">
          <li>
            <span className="text-slate-300">Strictly necessary:</span> authentication (for example,{" "}
            <span className="font-mono text-slate-300">httpOnly</span> session or token cookies), security,
            and load balancing. These are required for the app to work.
          </li>
          <li>
            <span className="text-slate-300">Preferences:</span> remember UI or jurisdiction choices
            when applicable.
          </li>
          <li>
            <span className="text-slate-300">Analytics (optional):</span> if we enable privacy-conscious
            analytics, we will use first-party, aggregated metrics where possible. We do not use
            third-party ad networks on the production application for targeted advertising.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Your choices</h2>
        <p>
          You can block or remove cookies through browser settings, but the operational application may
          not function without session cookies. Do not use shared public terminals for sign-in to
          sensitive government accounts without your agency’s procedure for clearing or incognito
          sessions.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Changes</h2>
        <p>We will update this page when our practices or technologies change in a material way.</p>
      </section>
    </LegalDocShell>
  );
}
