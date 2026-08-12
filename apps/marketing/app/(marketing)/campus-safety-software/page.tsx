import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/campus-safety-software";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Campus Safety Software for Universities | Rapid Cortex",
  description:
    "Campus safety software that helps university police and K-12 teams collect QR, NFC, and SMS reports, coordinate incidents, and document Clery-aware activity — without replacing campus police or 911.",
  path: PATH,
  keywords: [
    "campus safety software",
    "university safety platform",
    "campus incident reporting",
    "Clery Act documentation",
    "campus police software",
  ],
});

export default function CampusSafetySoftwarePage() {
  return (
    <KeywordLandingPage
      title="Campus Safety Software for Universities | Rapid Cortex"
      description="Campus safety software that helps university police and K-12 teams collect QR, NFC, and SMS reports, coordinate incidents, and document Clery-aware activity — without replacing campus police or 911."
      path={PATH}
      h1="Campus Safety Software for Universities and Schools"
      eyebrow="Campus safety software"
      intro="Rapid Cortex Campus is a university safety platform that helps campus police, public safety, and emergency management coordinators receive structured reports faster. It enhances existing campus operations. It does not replace campus police, 911, or medical direction."
      sections={[
        {
          title: "The campus reporting gap",
          body: "Students, faculty, and staff often notice a welfare concern, suspicious activity, or building issue long before anyone radios it in. Phone trees, apps nobody installed, and paper Clery logs leave campus safety teams reconstructing what happened after the fact.",
        },
        {
          title: "Capabilities built for campus operations",
          body: "Rapid Cortex Campus adds a low-friction reporting and coordination layer on top of the teams and systems you already run.",
          bullets: [
            "QR, NFC, and SMS reporting with no app download required",
            "Location-aware incident intake for buildings, floors, and outdoor zones",
            "Anonymous and welfare-routing options that do not belong in a security-only queue",
            "Live campus safety dashboard for officers and supervisors",
            "Audit-ready documentation that supports Clery-aware recordkeeping",
          ],
        },
        {
          title: "Campus safety integrations",
          body: "Connect consent-based cameras, QR/NFC wayfinding, and optional dispatch handoff so campus teams see the same incident context. Adapter maturity is contract-validated per campus.",
        },
        {
          title: "Compliance and operations notes",
          body: "Campus deployments are scoped for Clery-aware documentation, role-based access, and retention policies the institution configures. Rapid Cortex records who accessed what and when. It does not file Clery statistics or replace your Clery coordinator.",
        },
        {
          title: "What Rapid Cortex does not replace",
          body: "Campus police, municipal 911, emergency notification systems, and medical direction stay in place. Rapid Cortex is decision-support and incident intake — not a substitute for trained responders or statutory reporting offices.",
        },
      ]}
      relatedLinks={[
        { href: "/product/campus", label: "Rapid Cortex Campus product" },
        { href: "/campus-safety-integrations", label: "Campus safety integrations" },
        { href: "/integrations", label: "Integrations overview" },
        { href: "/connect/ring/start", label: "Ring Connect for campus" },
        { href: "/connect/nest", label: "Nest Connect" },
        { href: "/free-60-day-pilot", label: "Free 60-Day Pilot Program" },
        { href: "/blog/rapid-cortex-campus", label: "Blog: Rapid Cortex Campus" },
        { href: "/blog/campus-safety-trends", label: "Blog: Campus safety trends" },
        { href: "/blog/clery-act-reporting-requirements", label: "Blog: Clery Act reporting requirements" },
      ]}
      faq={[
        {
          question: "Does campus safety software replace campus police or 911?",
          answer:
            "No. Rapid Cortex Campus enhances campus safety operations. It does not replace campus police, municipal 911, or medical direction.",
        },
        {
          question: "What integrations does Rapid Cortex Campus support?",
          answer:
            "Campus deployments can include QR/NFC reporting, SMS intake, consent-based Ring and Nest camera flows, and optional handoff to dispatch. See campus safety integrations for the current adapter set.",
        },
        {
          question: "Can we evaluate campus safety software in a pilot?",
          answer:
            "Yes. Qualified campuses can run a Free 60-Day Pilot with non-disruptive deployment alongside existing radios, CAD, and emergency notification systems.",
        },
      ]}
    />
  );
}
