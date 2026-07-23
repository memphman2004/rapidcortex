import type { Metadata } from "next";
import { absoluteUrl, buildOgShareImage } from "@/lib/seo";

const DEST = "https://www.rapidcortex.us/contact-sales?interest=demo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Contact | Rapid Cortex",
    description: "Contact Rapid Cortex sales for demos, pilots, and procurement discussions.",
    robots: { index: false, follow: true },
    alternates: { canonical: absoluteUrl("/contact-sales?interest=demo") },
    openGraph: {
      title: "Contact | Rapid Cortex",
      url: DEST,
      images: [buildOgShareImage("Contact Rapid Cortex")],
      type: "website",
    },
  };
}

/** Legacy /contact → CRM sales form (static export refresh). */
export default function MarketingContactRedirectPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center text-slate-300">
      <meta httpEquiv="refresh" content={`0;url=${DEST}`} />
      <h1 className="text-xl font-semibold text-white">Taking you to Contact Sales…</h1>
      <p className="mt-4 text-sm">
        <a href={DEST} className="font-medium text-sky-400 hover:text-sky-300">
          Continue to the demo request form
        </a>
      </p>
      <script
        dangerouslySetInnerHTML={{
          __html: `window.location.replace(${JSON.stringify(DEST)});`,
        }}
      />
    </main>
  );
}
