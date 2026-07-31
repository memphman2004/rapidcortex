import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, buildOgShareImage } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Privacy | Rapid Cortex",
    description: "Privacy terms and data-handling overview for Rapid Cortex marketing and product experiences.",
    keywords: ["privacy policy", "rapid cortex privacy", "public safety data privacy"],
    openGraph: {
      title: "Privacy | Rapid Cortex",
      description: "Privacy and data-handling overview for Rapid Cortex.",
      url: absoluteUrl("/legal/privacy"),
      siteName: "Rapid Cortex",
      images: [buildOgShareImage("Rapid Cortex privacy policy")],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Privacy | Rapid Cortex",
      description: "Privacy and data-handling overview.",
      images: [{ url: buildOgShareImage().url, alt: buildOgShareImage().alt }],
    },
    alternates: { canonical: absoluteUrl("/legal/privacy") },
  };
}

export default function LegalPrivacyPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">Privacy</h1>
        <p className="text-sm text-slate-300">
          Rapid Cortex follows role-scoped access and tenant boundaries. Data handling details may vary by contract and
          deployment profile.
        </p>
      </header>
      <section className="mt-8 space-y-3 text-sm text-slate-300">
        <h2 className="text-xl font-medium text-white">Ring™ Device Owners</h2>
        <p>
          Rapid Cortex Connect is voluntary for Ring™ Device Owners. Enrollment happens in the Ring™ Appstore; when Ring™
          shows Pending — App sign-in required, owners finish linking with a Rapid Cortex device-owner account (not
          agency dispatcher login). Live video is not shared until the owner taps Allow on each SMS request. Owners may
          Decline, Stop Sharing, or disconnect Rapid Cortex Connect in Ring™ at any time. Rapid Cortex does not record or
          store Ring™ video (0-day retention).
        </p>
        <p>
          Full details:{" "}
          <Link href="/privacy" className="text-sky-300 hover:text-sky-200">
            Privacy policy
          </Link>
          .
        </p>
      </section>
      <section className="mt-8 space-y-3 text-sm text-slate-300">
        <h2 className="text-xl font-medium text-white">Questions</h2>
        <p>
          For privacy requests, contact{" "}
          <a className="text-sky-300 hover:text-sky-200" href="mailto:privacy@rapidcortex.us">
            privacy@rapidcortex.us
          </a>
          .
        </p>
        <p>
          For additional legal terms, review{" "}
          <Link href="/legal/terms" className="text-sky-300 hover:text-sky-200">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/legal/dpa" className="text-sky-300 hover:text-sky-200">
            DPA
          </Link>
          .
        </p>
      </section>
    </article>
  );
}

