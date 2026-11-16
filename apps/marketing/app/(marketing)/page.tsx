import type { Metadata } from "next";
import { HomepageAnalytics } from "@/components/sections/homepage/HomepageAnalytics";
import { HomepageHero } from "@/components/sections/homepage/HomepageHero";
import { SocialProofBar } from "@/components/sections/homepage/SocialProofBar";
import { ProblemStatement } from "@/components/sections/homepage/ProblemStatement";
import { ProductSolutionCards } from "@/components/sections/homepage/ProductSolutionCards";
import { WhyAgenciesChoose } from "@/components/sections/homepage/WhyAgenciesChoose";
import { EducationalResources } from "@/components/sections/homepage/EducationalResources";
import { MarketingSplashGate } from "@/components/marketing/marketing-splash-gate";
import { MarketingPilotResourcesStrip } from "@/components/marketing/pilot-resources-strip";
import { NewFeaturesSection } from "@/components/sections/NewFeaturesSection";
import { SITE_NAME } from "@/lib/site";
import { absoluteUrl, buildOrganizationJsonLd, buildWebsiteJsonLd, buildOgShareImage } from "@/lib/seo";

/** Document title segment — root layout `title.template` appends `| NexCort iQ`. */
const HOME_TITLE = "AI Public Safety Software for 911 & Emergency Operations";
const HOME_TITLE_FULL = `${HOME_TITLE} | ${SITE_NAME}`;
const HOME_DESCRIPTION =
  "NexCort iQ is an AI public safety software platform for 911 centers, law enforcement, campus safety, and emergency operations. Enhance dispatcher workflows, connect CAD systems, and automate non-emergency calls — without replacing the systems your agency already trusts.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    keywords: [
      "AI public safety software",
      "public safety software",
      "public safety intelligence",
      "AI 911 dispatcher software",
      "CAD interoperability",
      "AI non-emergency call automation",
      "campus safety technology",
      "public safety intelligence platform",
      "venue security software",
      "transit safety software",
      "nexcort iq",
    ],
    openGraph: {
      title: HOME_TITLE_FULL,
      description: HOME_DESCRIPTION,
      url: absoluteUrl("/"),
      siteName: SITE_NAME,
      images: [buildOgShareImage(`${SITE_NAME} home`)],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: HOME_TITLE_FULL,
      description: HOME_DESCRIPTION,
      images: [{ url: buildOgShareImage().url, alt: buildOgShareImage().alt }],
    },
    alternates: { canonical: absoluteUrl("/") },
  };
}

export default function MarketingHomePage() {
  const organizationJsonLd = {
    ...buildOrganizationJsonLd(),
    description:
      "AI public safety software for 911 emergency communications centers, law enforcement, campus safety, and transit operations.",
  };
  const websiteJsonLd = buildWebsiteJsonLd();
  const softwareApplicationJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: ["NexCortIQ", "NexCort"],
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Windows, macOS",
    url: absoluteUrl("/"),
    description:
      "AI public safety software platform that enhances 911 communications, connects existing CAD systems, automates non-emergency workflows, and strengthens situational awareness.",
    offers: [
      {
        "@type": "Offer",
        name: "Free 60-Day Pilot Program",
        description:
          "Qualified agencies and venues can evaluate NexCort iQ with a structured 60-day pilot.",
        price: "0",
        priceCurrency: "USD",
      },
    ],
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      alternateName: ["NexCortIQ", "NexCort"],
      url: absoluteUrl("/"),
      email: "Support@nexcortiq.us",
      founder: { "@type": "Person", name: "Dr. Jeffrey W. Coleman" },
    },
  };

  return (
    <div>
      <HomepageAnalytics />
      <MarketingSplashGate />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />

      <HomepageHero />
      <SocialProofBar />
      <ProblemStatement />
      <ProductSolutionCards />
      <NewFeaturesSection />
      <WhyAgenciesChoose />
      <MarketingPilotResourcesStrip />
      <EducationalResources />
    </div>
  );
}
