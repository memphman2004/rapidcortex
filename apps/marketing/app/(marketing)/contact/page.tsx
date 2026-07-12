import Link from "next/link";
import type { Metadata } from "next";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import {
  marketingDashboardPath,
  marketingLoginPath,
  marketingPricingPath,
} from "@/lib/marketing-links";
import { absoluteUrl } from "@/lib/seo";

const DEMO_MAILTO = "mailto:info@rapidcortex.us?subject=Rapid%20Cortex%20%E2%80%94%20Demo%20Request";
const SALES_MAILTO =
  "mailto:support@rapidcortex.us?subject=Rapid%20Cortex%20%E2%80%94%20Sales%20%26%20Pilot";
const EXEC_MAILTO =
  "mailto:info@rapidcortex.us?subject=Rapid%20Cortex%20%E2%80%94%20Executive%20Briefing";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Contact | Rapid Cortex",
    description: "Contact Rapid Cortex sales and operations for demos, pilots, and procurement discussions.",
    keywords: ["contact rapid cortex", "public safety demo request", "pilot request", "sales contact"],
    openGraph: {
      title: "Contact | Rapid Cortex",
      description: "Reach Rapid Cortex for demos and commercial planning.",
      url: absoluteUrl("/contact"),
      siteName: "Rapid Cortex",
      images: [{ url: absoluteUrl("/api/og"), width: 1200, height: 630, alt: "Contact Rapid Cortex" }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Contact | Rapid Cortex",
      description: "Contact Rapid Cortex for demos and pilot discussions.",
      images: [absoluteUrl("/api/og")],
    },
    alternates: { canonical: absoluteUrl("/contact") },
  };
}

export default function MarketingContactPage() {
  const pricing = marketingPricingPath();
  const login = marketingLoginPath();
  const app = marketingDashboardPath();

  return (
    <MarketingArticleShell
      eyebrow="Sales & operations"
      title="Contact us"
      sectionLabel="Contact"
    >
      <p>
        Rapid Cortex is sold through a consultative process: scoping, security review, and
        agency-specific configuration. Use the options below; we respond on business days.
      </p>
      <ul>
        <li>
          <strong>Book a demo</strong>:{" "}
          <a href={DEMO_MAILTO} className="font-medium">
            info@rapidcortex.us
          </a>
        </li>
        <li>
          <strong>Sales &amp; pilot</strong>:{" "}
          <a href={SALES_MAILTO} className="font-medium">
            support@rapidcortex.us
          </a>
        </li>
        <li>
          <strong>Executive briefings &amp; evaluation</strong>:{" "}
          <a href={EXEC_MAILTO} className="font-medium">
            info@rapidcortex.us
          </a>
        </li>
        <li>
          <strong>Privacy</strong>: see the email listed on our{" "}
          <Link href="/privacy" className="font-medium">
            Privacy policy
          </Link>
          .
        </li>
      </ul>
      <p className="hidden md:block">
        <strong>Already provisioned?</strong>{" "}
        <Link href={login} className="font-medium">
          Sign in
        </Link>{" "}
        or{" "}
        <Link href={app} className="font-medium">
          open the workspace
        </Link>
        .
      </p>
      <p>
        <Link href={pricing} className="font-medium">
          Plans &amp; pricing
        </Link>{" "}
        — no public per-seat price list; we scope each deployment.
      </p>
    </MarketingArticleShell>
  );
}
