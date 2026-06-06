import Link from "next/link";
import type { Metadata } from "next";
import { MarketingArticleShell } from "@/components/marketing/marketing-article-shell";
import { MarketingBookAppointmentLink } from "@/components/marketing/marketing-book-appointment-link";
import {
  marketingDashboardPath,
  marketingLoginPath,
  marketingPricingPath,
} from "@/lib/marketing-links";
import { PRICING_EXEC_DEMO_MAILTO, PRICING_SALES_MAILTO } from "@/lib/marketing/pricing-content";
import { absoluteUrl } from "@/lib/seo";

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
          <MarketingBookAppointmentLink className="font-medium">
            Request a demo (contact form)
          </MarketingBookAppointmentLink>
        </li>
        <li>
          <strong>Sales &amp; pilot</strong>:{" "}
          <a href={PRICING_SALES_MAILTO} className="font-medium">
            support@rapidcortex.us
          </a>
        </li>
        <li>
          <strong>Executive briefings &amp; evaluation</strong>:{" "}
          <a href={PRICING_EXEC_DEMO_MAILTO} className="font-medium">
            Request a conversation
          </a>
        </li>
        <li className="hidden md:list-item">
          <strong>Already provisioned?</strong>{" "}
          <Link href={login} className="font-medium">
            Sign in
          </Link>{" "}
          or{" "}
          <Link href={app} className="font-medium">
            open the workspace
          </Link>
          .
        </li>
        <li>
          <strong>Privacy</strong>: see the email listed on our{" "}
          <Link href="/privacy" className="font-medium">
            Privacy policy
          </Link>
          .
        </li>
      </ul>
      <p>
        <Link href={pricing} className="font-medium">
          Plans &amp; pricing
        </Link>{" "}
        — no public per-seat price list; we scope each deployment.
      </p>
    </MarketingArticleShell>
  );
}
