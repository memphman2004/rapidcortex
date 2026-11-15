import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/public-safety-intelligence";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Public Safety Intelligence Platform for 911 & Emergency Communications | NexCort iQ",
  description:
    "Public safety intelligence software that gives 911 dispatchers, supervisors, and emergency management teams real-time AI decision support — transcription, incident analysis, and situational awareness without replacing CAD.",
  path: PATH,
  keywords: [
    "public safety intelligence",
    "public safety intelligence platform",
    "public safety intelligence software",
    "AI public safety software",
    "emergency communications intelligence",
    "911 dispatch intelligence",
    "situational awareness software",
    "PSAP intelligence platform",
  ],
});

export default function PublicSafetyIntelligencePage() {
  return (
    <KeywordLandingPage
      title="Public Safety Intelligence Platform for 911 & Emergency Communications | NexCort iQ"
      description="Public safety intelligence software that gives 911 dispatchers, supervisors, and emergency management teams real-time AI decision support — transcription, incident analysis, and situational awareness without replacing CAD."
      path={PATH}
      h1="Public Safety Intelligence Software for 911 and Emergency Communications"
      eyebrow="Public safety intelligence"
      intro="NexCort iQ is a public safety intelligence platform that layers real-time AI decision support on top of existing CAD systems, telephony, and dispatch workflows. It does not replace dispatchers, medical direction, or the systems agencies already trust — it adds AI-assisted intelligence where it matters most: during active incidents."
      sections={[
        {
          title: "What public safety intelligence means in practice",
          body: "Public safety intelligence is the application of AI and data systems to emergency communications environments — giving dispatchers, supervisors, and emergency managers faster, clearer situational awareness without requiring them to change the tools they rely on.",
          bullets: [
            "Live call transcription with speaker identification during active 911 calls",
            "AI-generated incident summaries and priority scoring as calls progress",
            "Multilingual caller support with real-time translation overlays",
            "Surge View: automatic grouping of related 911 calls during mass-caller events",
            "LiveLocation Intelligence: caller-shared coordinates, accuracy radius, and movement",
            "Supervisor command view with team performance metrics and shift monitoring",
          ],
        },
        {
          title: "Public safety intelligence for every operational context",
          body: "NexCort iQ delivers public safety intelligence across four operational environments, each with dedicated role-based tooling and permission scoping.",
          bullets: [
            "911 Centers / PSAPs — dispatcher workspace, CAD integration, QA scoring, analytics",
            "Campus Safety — QR/NFC/SMS incident reporting, Clery-aware documentation",
            "Venue & Stadium Security — orange-branded ops console, event coordination",
            "Transit Operations — fleet safety, station-level incident tracking",
          ],
        },
        {
          title: "AI-assisted, not AI-autonomous",
          body: "NexCort iQ public safety intelligence is designed as a co-pilot — not a replacement for trained dispatchers or autonomous decision-making. Every AI output is a support signal reviewed by the human in the seat. CAD writeback, pre-arrival coaching, and protocol guidance are framed as decision support, never as directives.",
        },
        {
          title: "Security and compliance",
          body: "Public safety intelligence systems must meet strict security standards for law enforcement and emergency communications. NexCort iQ is CJIS-aligned, built on AWS enterprise infrastructure with encryption at rest and in transit, MFA enforcement, role-based access control, and audit logging on every incident action. It operates on AWS commercial (not GovCloud), satisfying CJIS Security Policy infrastructure requirements through FedRAMP Moderate certification.",
        },
        {
          title: "What NexCort iQ public safety intelligence does not replace",
          body: "The platform enhances operations — it does not replace Computer-Aided Dispatch, telephony infrastructure, 911 call handling, medical direction, or trained dispatchers. Agencies retain full control of their core systems while adding an AI intelligence layer.",
        },
      ]}
      relatedLinks={[
        { href: "/product/core", label: "NexCort iQ Core — 911 Centers / PSAPs" },
        { href: "/ai-public-safety-software", label: "AI public safety software overview" },
        { href: "/911-dispatch-software", label: "911 dispatch software" },
        { href: "/psap-software", label: "PSAP software" },
        { href: "/ng911-software", label: "NG911 software" },
        { href: "/cad-integration", label: "CAD integration" },
        { href: "/campus-safety-software", label: "Campus safety software" },
        { href: "/free-60-day-pilot", label: "Free 60-Day Pilot Program" },
      ]}
      faq={[
        {
          question: "What is public safety intelligence software?",
          answer:
            "Public safety intelligence software applies AI and real-time data to emergency communications environments — giving 911 dispatchers, supervisors, and emergency managers faster situational awareness, automated transcription, incident analysis, and decision support during active calls and incidents.",
        },
        {
          question: "Does NexCort iQ replace CAD or dispatch systems?",
          answer:
            "No. NexCort iQ is an intelligence layer that connects to existing CAD systems. It enhances dispatchers' situational awareness without replacing CAD, telephony, or trained personnel.",
        },
        {
          question: "What agencies use public safety intelligence platforms?",
          answer:
            "911 centers, PSAPs, law enforcement communications divisions, fire and EMS agencies, campus safety departments, venue security operations, and transit safety teams all use NexCort iQ public safety intelligence tools.",
        },
        {
          question: "Is NexCort iQ CJIS compliant?",
          answer:
            "NexCort iQ is CJIS-aligned: encryption at rest and in transit, MFA, role-based access control, audit logging on all incident actions, and AWS FedRAMP Moderate infrastructure. Agencies execute a CJIS Security Addendum as part of onboarding.",
        },
        {
          question: "How long does it take to deploy a public safety intelligence platform?",
          answer:
            "Most agencies complete a Non-Disruptive 60-Day Pilot in 2–4 weeks of setup including CAD webhook configuration. The platform runs alongside existing systems — no rip-and-replace required.",
        },
      ]}
    />
  );
}
