import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/venue-safety-integrations";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Venue Safety Integrations | Cameras, QR/SMS, SOC | Rapid Cortex",
  description:
    "Venue safety integrations for stadiums and arenas: QR/SMS guest reporting, consent-based cameras, and SOC workflows — adapters validated per contract, not a rip-and-replace of radios or 911.",
  path: PATH,
  keywords: [
    "venue safety integrations",
    "stadium camera integrations",
    "QR SMS venue reporting",
    "SOC incident workflows",
    "arena security integrations",
  ],
});

export default function VenueSafetyIntegrationsPage() {
  return (
    <KeywordLandingPage
      title="Venue Safety Integrations | Cameras, QR/SMS, SOC | Rapid Cortex"
      description="Venue safety integrations for stadiums and arenas: QR/SMS guest reporting, consent-based cameras, and SOC workflows — adapters validated per contract, not a rip-and-replace of radios or 911."
      path={PATH}
      h1="Venue Safety Integrations for Stadiums and Arenas"
      eyebrow="Venue safety integrations"
      intro="Rapid Cortex Venue connects guest reporting channels and optional camera consent flows to the security operations dashboard. Integrations enhance SOC workflows. They do not replace radios, CCTV matrices, venue security, or 911."
      sections={[
        {
          title: "Why venue integrations matter",
          body: "A text from Section 112 and a camera on the north concourse only help if they share an incident. Integrations exist so QR/SMS reports, media, and camera references land on one SOC record.",
        },
        {
          title: "What Rapid Cortex connects",
          body: "Adapter coverage is scoped per venue. Maturity varies and is contract-validated.",
          bullets: [
            "QR and NFC signs mapped to gates, sections, and concourses",
            "SMS reporting with venue code and location parsing",
            "Consent-based Ring Connect and Nest SDM camera flows",
            "Nearby camera references on the SOC incident card",
            "Optional escalation into Rapid Cortex Core for emergency communications",
          ],
        },
        {
          title: "SOC workflows, not a new radio net",
          body: "Supervisors assign, chat, and close incidents in the dashboard. Radios and existing video walls stay in place. Rapid Cortex does not become your CAD or public-address system.",
        },
        {
          title: "Operations notes",
          body: "Connectors are enabled per facility and event calendar. Access is audited. Rapid Cortex is not a 911 emergency dispatch system and does not provide medical direction.",
        },
        {
          title: "What these integrations do not replace",
          body: "Venue security contractors, law enforcement details, EMS, CCTV control rooms, and 911 remain the response stack. Rapid Cortex feeds structured reports into the SOC.",
        },
      ]}
      relatedLinks={[
        { href: "/product/venue", label: "Rapid Cortex Venue product" },
        { href: "/venue", label: "Venue safety intelligence" },
        { href: "/venue-safety-software", label: "Venue safety software" },
        { href: "/stadium-security-software", label: "Stadium security software" },
        { href: "/integrations", label: "Integrations overview" },
        { href: "/connect/ring/start", label: "Start Ring Connect" },
        { href: "/connect/nest", label: "Nest Connect" },
        { href: "/free-60-day-pilot", label: "Free 60-Day Pilot Program" },
        { href: "/blog/rapid-cortex-venue", label: "Blog: Rapid Cortex Venue" },
        { href: "/blog/stadium-fan-safety-without-adding-staff", label: "Blog: Stadium fan safety without adding staff" },
      ]}
      faq={[
        {
          question: "Do venue safety integrations replace 911 or our SOC cameras?",
          answer:
            "No. Rapid Cortex does not replace 911, medical direction, radios, or your CCTV matrix. Integrations attach reports and optional consent-based camera context to the SOC dashboard.",
        },
        {
          question: "What reporting channels can we integrate?",
          answer:
            "QR/NFC signs, SMS with a venue code, and optional Ring or Nest Connect consent flows. Other camera stacks are scoped per contract.",
        },
        {
          question: "Can we pilot venue integrations on a subset of zones?",
          answer:
            "Yes. Qualified venues can evaluate a Free 60-Day Pilot with a limited zone set before a full-facility rollout.",
        },
      ]}
    />
  );
}
