import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, buildOgShareImage } from "@/lib/seo";
import { SITE_NAME, SITE_OPERATOR_NAME, SITE_OPERATOR_URL } from "@/lib/site";

const PRESS_EMAIL = "info@rapidcortex.us";
const FOUNDED_YEAR = 2025;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `About | ${SITE_NAME}`,
    description: `${SITE_NAME} is a product of ${SITE_OPERATOR_NAME}, founded in ${FOUNDED_YEAR}. Decision-support software for emergency communications, 911 dispatch, campus safety, and venue operations.`,
    keywords: [
      "rapid cortex",
      "apps on demand",
      "public safety technology",
      "emergency communications",
      "dispatch intelligence",
      "founded 2025",
    ],
    openGraph: {
      title: `About | ${SITE_NAME}`,
      description: `${SITE_NAME} — a product of ${SITE_OPERATOR_NAME}, founded in ${FOUNDED_YEAR}. Emergency response intelligence for public safety agencies.`,
      url: absoluteUrl("/about"),
      siteName: SITE_NAME,
      images: [buildOgShareImage(`About ${SITE_NAME}`)],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `About | ${SITE_NAME}`,
      description: `A product of ${SITE_OPERATOR_NAME}, founded in ${FOUNDED_YEAR}. Mission-focused emergency communications intelligence.`,
      images: [{ url: buildOgShareImage().url, alt: buildOgShareImage().alt }],
    },
    alternates: { canonical: absoluteUrl("/about") },
  };
}

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-red-400">
          About · Founded {FOUNDED_YEAR}
        </p>
        <h1 className="text-3xl font-semibold text-white sm:text-4xl">About {SITE_NAME}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-300">
          {SITE_NAME} is a product of{" "}
          <a
            href={SITE_OPERATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 hover:text-sky-200"
          >
            {SITE_OPERATOR_NAME}
          </a>
          , founded in {FOUNDED_YEAR}. We build decision-support software for emergency
          communications teams operating in high-stakes, time-critical environments.
        </p>
      </header>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-slate-300">
        <h2 className="text-xl font-medium text-white">Company</h2>
        <p>
          {SITE_NAME} is developed and operated by {SITE_OPERATOR_NAME} (
          <a
            href={SITE_OPERATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-300 hover:text-sky-200"
          >
            www.appsondemand.net
          </a>
          ). The company was founded in {FOUNDED_YEAR} to deliver real-time operational intelligence
          for public safety agencies — without replacing CAD, telephony, dispatchers, or medical
          direction.
        </p>
        <dl className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product</dt>
            <dd className="mt-1 text-slate-200">{SITE_NAME}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operator</dt>
            <dd className="mt-1 text-slate-200">{SITE_OPERATOR_NAME}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Founded</dt>
            <dd className="mt-1 text-slate-200">{FOUNDED_YEAR}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Press contact
            </dt>
            <dd className="mt-1">
              <a href={`mailto:${PRESS_EMAIL}`} className="text-sky-300 hover:text-sky-200">
                {PRESS_EMAIL}
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-slate-300">
        <h2 className="text-xl font-medium text-white">Our focus</h2>
        <p>
          As a product of {SITE_OPERATOR_NAME}, {SITE_NAME} designs tools that improve situational
          awareness and coordination across 911 operations, campus safety, and venue command
          workflows.
        </p>
        <p>
          The platform is built to augment trained professionals with better context, not replace
          dispatch judgment or established protocols.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm leading-relaxed text-slate-300">
        <h2 className="text-xl font-medium text-white">Press &amp; media</h2>
        <p>
          For press inquiries, interviews, and media assets related to {SITE_NAME} and{" "}
          {SITE_OPERATOR_NAME}, contact{" "}
          <a href={`mailto:${PRESS_EMAIL}`} className="text-sky-300 hover:text-sky-200">
            {PRESS_EMAIL}
          </a>
          . Additional press resources are available on our{" "}
          <Link href="/press" className="text-sky-300 hover:text-sky-200">
            Press &amp; Media
          </Link>{" "}
          page.
        </p>
      </section>

      <section className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link
          href="/contact-sales?interest=demo"
          className="inline-flex font-medium text-sky-300 hover:text-sky-200"
        >
          Request a demo
        </Link>
        <Link href="/press" className="inline-flex font-medium text-sky-300 hover:text-sky-200">
          Press kit
        </Link>
        <a
          href={SITE_OPERATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex font-medium text-sky-300 hover:text-sky-200"
        >
          {SITE_OPERATOR_NAME}
        </a>
      </section>
    </article>
  );
}
