import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/campus-safety-integrations";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Campus Safety Integrations | Ring, Nest, QR/NFC | Rapid Cortex",
  description:
    "Campus safety integrations for universities: consent-based Ring and Nest cameras, QR/NFC and SMS reporting, and optional dispatch handoff — contract-validated adapters, not a rip-and-replace.",
  path: PATH,
  keywords: [
    "campus safety integrations",
    "university camera integrations",
    "Ring campus safety",
    "Nest campus cameras",
    "QR NFC campus reporting",
  ],
});

export default function CampusSafetyIntegrationsPage() {
  return (
    <KeywordLandingPage
      title="Campus Safety Integrations | Ring, Nest, QR/NFC | Rapid Cortex"
      description="Campus safety integrations for universities: consent-based Ring and Nest cameras, QR/NFC and SMS reporting, and optional dispatch handoff — contract-validated adapters, not a rip-and-replace."
      path={PATH}
      h1="Campus Safety Integrations for Universities"
      eyebrow="Campus safety integrations"
      intro="Rapid Cortex Campus connects reporting channels and consent-based cameras to the campus safety console. Integrations enhance existing campus police and emergency-management workflows. They do not replace campus police, 911, or medical direction."
      sections={[
        {
          title: "Why campus integrations matter",
          body: "A Clery log, a radio, and a camera wall that do not share an incident ID leave officers reconstructing context. Integrations exist so a QR report, a welfare text, and a consented doorbell clip can land on the same record.",
        },
        {
          title: "What Rapid Cortex connects",
          body: "Adapter coverage is scoped per campus and validated on contract. Maturity varies by vendor and site.",
          bullets: [
            "QR and NFC location tags for buildings, lots, and event spaces",
            "SMS reporting into the campus safety dashboard",
            "Ring Connect — consent-based emergency video from device owners",
            "Google Nest SDM — agency-linked cameras plus citizen consent requests",
            "Optional handoff to municipal dispatch / CAD-friendly workflows",
          ],
        },
        {
          title: "Camera consent, not camera takeover",
          body: "Ring and Nest Connect are consent flows. Rapid Cortex does not silently tap residential cameras. Campus-owned Nest devices can be agency-linked; resident devices require an explicit request during an incident.",
        },
        {
          title: "Compliance and operations notes",
          body: "Access is role-scoped and audited. Clery-aware documentation is supported; Rapid Cortex does not file your Annual Security Report. Retention follows the institution’s policy, not a hidden vendor default.",
        },
        {
          title: "What these integrations do not replace",
          body: "Campus police CAD, emergency notification (ENS), access control, and 911 stay systems of record. Rapid Cortex adapters feed incident intelligence into the campus console.",
        },
      ]}
      relatedLinks={[
        { href: "/product/campus", label: "Rapid Cortex Campus product" },
        { href: "/campus-safety-software", label: "Campus safety software" },
        { href: "/integrations", label: "Integrations overview" },
        { href: "/connect/ring/start", label: "Start Ring Connect" },
        { href: "/connect/nest", label: "Nest Connect" },
        { href: "/cad-integration", label: "CAD integration" },
        { href: "/free-60-day-pilot", label: "Free 60-Day Pilot Program" },
        { href: "/blog/rapid-cortex-campus", label: "Blog: Rapid Cortex Campus" },
        { href: "/blog/clery-act-reporting-requirements", label: "Blog: Clery Act reporting requirements" },
      ]}
      faq={[
        {
          question: "Do campus safety integrations replace campus police systems?",
          answer:
            "No. Rapid Cortex adapters sit alongside campus police, ENS, and 911. They do not replace those systems or medical direction.",
        },
        {
          question: "Which cameras can we integrate?",
          answer:
            "Consent-based Ring Connect and Google Nest SDM are the public Connect paths. Campus-owned Nest devices can be agency-linked. Other CCTV stacks are scoped per contract.",
        },
        {
          question: "Can we pilot integrations before a campus-wide rollout?",
          answer:
            "Yes. Qualified campuses can evaluate reporting plus Connect flows in a Free 60-Day Pilot with non-disruptive deployment.",
        },
      ]}
    />
  );
}
