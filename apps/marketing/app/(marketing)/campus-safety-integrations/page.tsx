import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/campus-safety-integrations";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Campus Safety Integrations | Nest, Wyze, QR/NFC | NexCort iQ",
  description:
    "Campus safety integrations for universities: consent-based Nest and Wyze cameras, QR/NFC and SMS reporting, and optional dispatch handoff — contract-validated adapters, not a rip-and-replace.",
  path: PATH,
  keywords: [
    "campus safety integrations",
    "university camera integrations",
    "Nest campus cameras",
    "QR NFC campus reporting",
  ],
});

export default function CampusSafetyIntegrationsPage() {
  return (
    <KeywordLandingPage
      title="Campus Safety Integrations | Nest, Wyze, QR/NFC | NexCort iQ"
      description="Campus safety integrations for universities: consent-based Nest and Wyze cameras, QR/NFC and SMS reporting, and optional dispatch handoff — contract-validated adapters, not a rip-and-replace."
      path={PATH}
      h1="Campus Safety Integrations for Universities"
      eyebrow="Campus safety integrations"
      intro="NexCort iQ Campus connects reporting channels and consent-based cameras to the campus safety console. Integrations enhance existing campus police and emergency-management workflows. They do not replace campus police, 911, or medical direction."
      sections={[
        {
          title: "Why campus integrations matter",
          body: "A Clery log, a radio, and a camera wall that do not share an incident ID leave officers reconstructing context. Integrations exist so a QR report, a welfare text, and a consented doorbell clip can land on the same record.",
        },
        {
          title: "What NexCort iQ connects",
          body: "Adapter coverage is scoped per campus and validated on contract. Maturity varies by vendor and site.",
          bullets: [
            "QR and NFC location tags for buildings, lots, and event spaces",
            "SMS reporting into the campus safety dashboard",
            "Google Nest SDM — agency-linked cameras plus citizen consent requests",
            "Wyze Connect — homeowner API keys with SMS consent per request",
            "Optional handoff to municipal dispatch / CAD-friendly workflows",
          ],
        },
        {
          title: "Camera consent, not camera takeover",
          body: "Ring, Nest, and Wyze Connect are consent flows. NexCort iQ does not silently tap residential cameras. Campus-owned Nest devices can be agency-linked; resident devices require an explicit request during an incident.",
        },
        {
          title: "Compliance and operations notes",
          body: "Access is role-scoped and audited. Clery-aware documentation is supported; NexCort iQ does not file your Annual Security Report. Retention follows the institution’s policy, not a hidden vendor default.",
        },
        {
          title: "What these integrations do not replace",
          body: "Campus police CAD, emergency notification (ENS), access control, and 911 stay systems of record. NexCort iQ adapters feed incident intelligence into the campus console.",
        },
      ]}
      relatedLinks={[
        { href: "/product/campus", label: "NexCort iQ Campus product" },
        { href: "/campus-safety-software", label: "Campus safety software" },
        { href: "/integrations", label: "Integrations overview" },
        { href: "/connect/nest", label: "Nest Connect" },
        { href: "/connect/wyze/start", label: "Wyze Connect" },
        { href: "/cad-integration", label: "CAD integration" },
        { href: "/free-60-day-pilot", label: "Free 60-Day Pilot Program" },
        { href: "/blog/rapid-cortex-campus", label: "Blog: NexCort iQ Campus" },
        { href: "/blog/clery-act-reporting-requirements", label: "Blog: Clery Act reporting requirements" },
      ]}
      faq={[
        {
          question: "Do campus safety integrations replace campus police systems?",
          answer:
            "No. NexCort iQ adapters sit alongside campus police, ENS, and 911. They do not replace those systems or medical direction.",
        },
        {
          question: "Which cameras can we integrate?",
          answer:
            "Consent-based Google Nest SDM and Wyze Connect are the public Connect paths. Campus-owned Nest devices can be agency-linked. Other CCTV stacks are scoped per contract.",
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
