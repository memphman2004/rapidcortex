import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/ai-public-safety-software";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "AI Public Safety Software for 911, PSAPs & Emergency Response | NexCort iQ",
  description:
    "AI public safety software that gives 911 centers, PSAPs, campus safety, and venue operations real-time transcription, incident intelligence, and multilingual support — without replacing CAD or dispatchers.",
  path: PATH,
  keywords: [
    "AI public safety software",
    "public safety software",
    "AI 911 dispatch software",
    "PSAP AI software",
    "emergency response software",
    "public safety AI platform",
    "AI emergency communications",
    "911 AI software",
    "real-time dispatch intelligence",
  ],
});

export default function AiPublicSafetySoftwarePage() {
  return (
    <KeywordLandingPage
      title="AI Public Safety Software for 911, PSAPs & Emergency Response | NexCort iQ"
      description="AI public safety software that gives 911 centers, PSAPs, campus safety, and venue operations real-time transcription, incident intelligence, and multilingual support — without replacing CAD or dispatchers."
      path={PATH}
      h1="AI Public Safety Software for 911 Centers, PSAPs &amp; Emergency Operations"
      eyebrow="AI public safety software"
      intro="NexCort iQ is AI public safety software built from the ground up for emergency communications environments. It delivers real-time transcription, AI-generated incident summaries, multilingual caller support, and command-center situational awareness — running alongside CAD, telephony, and the dispatch systems agencies already depend on."
      sections={[
        {
          title: "What AI public safety software does",
          body: "AI public safety software applies machine learning and natural language processing to emergency communications workflows — reducing cognitive load on dispatchers, surfacing critical information faster, and helping supervisors monitor operations in real time.",
          bullets: [
            "Live 911 call transcription with speaker labels and timestamp indexing",
            "AI-generated incident summaries during and after active calls",
            "Real-time priority scoring based on call content and incident type",
            "Multilingual translation overlays for non-English 911 callers",
            "Surge View: AI-driven grouping of related mass-caller events",
            "SOP compliance monitoring and protocol-aligned coaching hints",
            "LiveLocation Intelligence with caller-shared GPS coordinates and accuracy data",
          ],
        },
        {
          title: "AI public safety software for every agency type",
          body: "NexCort iQ delivers AI public safety software across four operational verticals, each with its own role-based console, permission model, and feature set.",
          bullets: [
            "911 Centers / PSAPs — full dispatcher and supervisor AI workspace with CAD integration",
            "Campus Safety — QR/NFC/SMS AI reporting for university and K-12 safety teams",
            "Venue & Stadium Security — AI operations console for events and large venues",
            "Transit Safety — fleet, station, and route-level AI incident tracking",
          ],
        },
        {
          title: "CAD integration: AI adds on, it does not replace",
          body: "NexCort iQ AI public safety software integrates with major CAD vendors including Motorola PremierOne, Tyler New World, CentralSquare, and Hexagon via secure webhook. AI analysis enriches the existing incident record — it does not write to CAD without dispatcher review. CAD writeback is fail-closed by design and requires explicit agency opt-in.",
        },
        {
          title: "Security and compliance for AI in public safety",
          body: "Public safety AI software must meet strict security requirements. NexCort iQ is CJIS-aligned: AES-256 encryption at rest and in transit, MFA enforced across all roles, role-based access control, audit logging on every incident action, and AWS FedRAMP Moderate infrastructure. The platform operates on AWS commercial (us-east-1) with agency-scoped data isolation — no cross-tenant data access is architecturally possible.",
        },
        {
          title: "AI that supports dispatchers — not autonomous AI",
          body: "Every AI output in NexCort iQ is designed as a decision-support signal, not an autonomous directive. Dispatchers see AI summaries, translation overlays, and coaching hints — but all actions remain under human control. This is a deliberate design principle: emergency communications requires human judgment, not AI autonomy.",
        },
        {
          title: "Deployment: 60-Day Non-Disruptive Pilot",
          body: "Agencies can evaluate NexCort iQ AI public safety software in a Free 60-Day Pilot that runs alongside existing systems with no rip-and-replace. Most agencies complete onboarding and CAD webhook configuration in 2–4 weeks and are running live during the pilot.",
        },
      ]}
      relatedLinks={[
        { href: "/product/core", label: "NexCort iQ Core — 911 Centers / PSAPs" },
        { href: "/public-safety-intelligence", label: "Public safety intelligence platform" },
        { href: "/911-dispatch-software", label: "911 dispatch software" },
        { href: "/psap-software", label: "PSAP software" },
        { href: "/ng911-software", label: "NG911 software" },
        { href: "/cad-integration", label: "CAD integration overview" },
        { href: "/cad-interoperability", label: "CAD-to-CAD interoperability" },
        { href: "/campus-safety-software", label: "Campus safety software" },
        { href: "/iq-vision", label: "iQ Vision AI camera intelligence" },
        { href: "/free-60-day-pilot", label: "Free 60-Day Pilot Program" },
      ]}
      faq={[
        {
          question: "What is AI public safety software?",
          answer:
            "AI public safety software applies artificial intelligence to emergency communications workflows — providing real-time transcription, incident analysis, priority scoring, multilingual support, and situational awareness for 911 dispatchers, supervisors, and emergency management teams.",
        },
        {
          question: "How does AI public safety software integrate with CAD?",
          answer:
            "NexCort iQ connects to CAD systems via secure webhooks. AI-generated summaries and incident data enrich existing CAD records. Writeback to CAD requires dispatcher review and is fail-closed by default — agencies must explicitly opt in through a signed addendum.",
        },
        {
          question: "Is AI public safety software CJIS compliant?",
          answer:
            "NexCort iQ is CJIS-aligned: encryption at rest and in transit, MFA enforced, role-based access control, audit logging on all incident actions, and AWS FedRAMP Moderate infrastructure. Agencies sign a CJIS Security Addendum during onboarding.",
        },
        {
          question: "Does AI public safety software replace dispatchers?",
          answer:
            "No. NexCort iQ is explicitly a co-pilot, not a replacement. AI outputs are decision-support signals reviewed by the dispatcher. The platform enhances human judgment — it does not make autonomous dispatch decisions.",
        },
        {
          question: "What 911 center or PSAP sizes does AI public safety software support?",
          answer:
            "NexCort iQ scales from single-seat PSAPs to large multi-agency centers. Pricing is per-seat and role-based. The Free 60-Day Pilot is available for qualified agencies of any size.",
        },
        {
          question: "How long does it take to deploy AI public safety software?",
          answer:
            "Most agencies complete onboarding, CAD webhook configuration, and dispatcher training in 2–4 weeks. The 60-Day Pilot is non-disruptive — it runs in parallel with existing systems from day one.",
        },
      ]}
    />
  );
}
