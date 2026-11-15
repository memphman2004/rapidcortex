import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/cad-interoperability";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "CAD-to-CAD Interoperability Software | NexCort iQ",
  description:
    "NexCort iQ's CAD-to-CAD Hub connects agencies using different CAD platforms — enabling bidirectional incident sharing and multi-agency coordination without replacing existing systems of record.",
  path: PATH,
});

export default function CadInteroperabilityPage() {
  return (
    <KeywordLandingPage
      title="CAD-to-CAD Interoperability Software | NexCort iQ"
      description="NexCort iQ's CAD-to-CAD Hub connects agencies using different CAD platforms — enabling bidirectional incident sharing and multi-agency coordination without replacing existing systems of record."
      path={PATH}
      h1="CAD-to-CAD Interoperability and Multi-Agency Coordination"
      eyebrow="CAD Interoperability — NexCort iQ"
      intro="Most agencies operate on different CAD platforms. When a cross-jurisdictional incident requires mutual aid, automatic aid, or border response, dispatchers from both agencies need to see the same incident picture — but their systems were never designed to share data with each other. NexCort iQ's CAD-to-CAD Hub bridges these gaps without requiring either agency to replace their existing CAD."
      sections={[
        {
          title: "The CAD interoperability challenge",
          body: "Law enforcement, fire, and EMS agencies across the same region often operate on different CAD platforms — Motorola PremierOne, Tyler New World, Console1, Hexagon, and others. During mutual aid events, border incidents, or multi-agency responses, dispatchers must relay information manually between systems — by phone, radio, or manual re-entry — increasing the risk of data errors and response delays. CAD-to-CAD interoperability solves this at the data layer.",
        },
        {
          title: "What the CAD-to-CAD Hub provides",
          body: "NexCort iQ's CAD-to-CAD Hub enables incident data to flow between participating agencies on different CAD platforms, reducing manual relay and improving shared situational awareness.",
          bullets: [
            "Bidirectional incident sharing across heterogeneous CAD systems",
            "Real-time incident updates visible to authorized agencies without manual re-entry",
            "Support for automatic aid, mutual aid, and border incident scenarios",
            "Configurable sharing rules — agencies control what data is shared and with whom",
            "Dispatcher review of incoming shared incidents before any local CAD entry",
            "Audit log of all cross-agency incident sharing for accountability and review",
          ],
        },
        {
          title: "What it does not do",
          body: "The CAD-to-CAD Hub does not replace either agency's existing CAD. Neither agency's system of record is modified. Dispatchers retain full control — shared incident data is never automatically written into a local CAD without dispatcher review and approval. This fail-closed design is a core safety requirement for all CAD-adjacent integrations in NexCort iQ.",
        },
        {
          title: "Multi-agency coordination in practice",
          body: "When an incident is created in Agency A's CAD and shared with Agency B, Agency B's dispatchers see a notification with the incident details in the NexCort iQ shared view. If a local CAD entry is warranted, the dispatcher reviews and approves it. No data crosses agency boundaries without an authorized dispatcher in the loop.",
        },
        {
          title: "Deployment and CAD compatibility",
          body: "CAD-to-CAD integration scope depends on each agency's CAD platform, version, and API capabilities. NexCort iQ has worked with agencies on Motorola PremierOne, Tyler New World, and Console1 environments. Contact sales to evaluate your specific CAD configuration before beginning a pilot. Full compatibility with every CAD version is not guaranteed and must be verified.",
        },
        {
          title: "Regional 911 center and PSAP coordination",
          body: "The CAD-to-CAD Hub is relevant to regional coordination efforts, shared dispatch consolidation planning, and NG911 interoperability initiatives. It provides a software-layer bridge for agencies working toward improved data sharing without requiring full CAD consolidation or infrastructure replacement.",
        },
      ]}
      faq={[
        {
          question: "Does CAD-to-CAD interoperability require replacing our existing CAD?",
          answer:
            "No. The CAD-to-CAD Hub is designed to work alongside existing CAD platforms. Neither agency's CAD is replaced or modified — the hub connects them through an API integration layer.",
        },
        {
          question: "Is our existing CAD platform supported?",
          answer:
            "Integration scope depends on your specific CAD platform, version, and API access. NexCort iQ has experience with Motorola PremierOne, Tyler New World, and Console1. Full compatibility with all CAD platforms and versions is not guaranteed and must be evaluated before deployment.",
        },
        {
          question: "Can our agency control what incident data is shared with neighboring agencies?",
          answer:
            "Yes. Data sharing rules are configured by agency — including which incident types, geographic areas, or unit types trigger a share to neighboring jurisdictions. Agencies retain control over their sharing policies.",
        },
        {
          question: "Is CAD writeback ever automatic?",
          answer:
            "No. Dispatcher review and approval are required before any shared incident is written into a local CAD. This is a non-negotiable safety requirement in NexCort iQ's CAD integration design.",
        },
        {
          question: "Is this the same as an NG911 ESInet or CAD consolidation?",
          answer:
            "No. The CAD-to-CAD Hub is a software-layer interoperability solution — not an ESInet, full CAD consolidation, or telephony infrastructure replacement. It is designed for agencies that need improved data sharing while operating their existing CAD systems independently.",
        },
      ]}
      relatedLinks={[
        { href: "/cad-integration", label: "CAD Integration for 911 Centers" },
        { href: "/ng911-software", label: "NG911 Modernization Software" },
        { href: "/product/core", label: "NexCort iQ Core — 911 / PSAP Platform" },
        { href: "/grants", label: "Funding and Grant Resources" },
        { href: "/free-60-day-pilot", label: "Apply for a Free 60-Day Pilot" },
        { href: "/contact-sales", label: "Talk with Sales About CAD Interoperability" },
      ]}
    />
  );
}
