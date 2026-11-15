import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/ai-311";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "AI 311 and Municipal Non-Emergency Call Handling | NexCort iQ",
  description:
    "NexCort iQ automates municipal 311 services and police non-emergency lines with conversational AI — handling caller intake, service routing, and multilingual requests without replacing city staff.",
  path: PATH,
});

export default function Ai311Page() {
  return (
    <KeywordLandingPage
      title="AI 311 and Municipal Non-Emergency Call Handling | NexCort iQ"
      description="NexCort iQ automates municipal 311 services and police non-emergency lines with conversational AI — handling caller intake, service routing, and multilingual requests without replacing city staff."
      path={PATH}
      h1="AI-Powered 311 and Municipal Call Handling"
      eyebrow="NEXiQ — NexCort iQ"
      intro="Cities and counties receive thousands of non-emergency calls each week — service requests, complaint intake, permit inquiries, and general information requests. NexCort iQ's NEXiQ platform automates the intake and routing layer for municipal 311 services and police non-emergency lines, reducing call center staffing pressure while preserving human handling for complex or sensitive inquiries."
      sections={[
        {
          title: "What 311 AI automation addresses",
          body: "311 call centers and police non-emergency lines share a common challenge: a large volume of structured, predictable requests that follow repeatable patterns. Callers reporting noise complaints, requesting bulk trash pickup, asking about permit status, or inquiring about city hours are well-suited to automated intake. NEXiQ handles these interactions without replacing the human tier.",
          bullets: [
            "Automated intake for structured non-emergency service requests",
            "Information delivery for city services, hours, locations, and eligibility",
            "Self-service status updates for previously submitted requests",
            "Routing to the correct department or on-call staff when human handling is required",
            "Multilingual call handling — additional languages beyond English/Spanish are agency-configured",
            "Intake summaries delivered to staff when transferring to a human agent",
          ],
        },
        {
          title: "Police non-emergency line automation",
          body: "Police non-emergency lines receive a disproportionate share of calls that do not require immediate dispatch: parking concerns, minor vandalism reports, lost property, noise, and community service inquiries. NEXiQ reduces the call burden on dispatch staff by handling structured intake at the front of the call queue, reserving dispatcher time for callers who require human attention.",
        },
        {
          title: "Multilingual municipal service automation",
          body: "Cities serving diverse populations can configure NEXiQ with additional language options to extend service access without staffing a multilingual call center. Callers who speak a supported language can receive intake assistance in their preferred language, with structured summaries delivered in English to city staff.",
        },
        {
          title: "What AI-powered 311 does not replace",
          body: "NEXiQ automates intake and routing — not judgment. Callers who express distress, describe urgent situations, or whose requests fall outside the configured intake scope are transferred to human staff. 911 emergency calls are never intercepted or delayed. The goal is to reduce the volume of routine work, not to eliminate human contact for callers who need it.",
        },
        {
          title: "Integration with existing city systems",
          body: "NEXiQ connects to existing municipal phone infrastructure through Amazon Connect without requiring cities to replace their PBX or call center platform. Intake data can be structured for integration with existing service request tracking or records management systems, depending on the city's existing software environment.",
        },
      ]}
      faq={[
        {
          question: "Is NEXiQ a replacement for our 311 call center staff?",
          answer:
            "No. NEXiQ automates structured intake and routing tasks, reducing call volume handled manually. Human staff handle complex requests, sensitive inquiries, and callers who prefer or require human assistance.",
        },
        {
          question: "Can NEXiQ handle service request types specific to our city?",
          answer:
            "Yes. Call flows, intake form fields, service categories, and routing logic are configured to match the city's specific departments, services, and request types.",
        },
        {
          question: "Does NEXiQ create service request records in our existing system?",
          answer:
            "NEXiQ can generate structured intake summaries. Integration with specific service request management, 311, or records systems depends on the city's existing software. Discuss your environment during the pilot evaluation.",
        },
        {
          question: "How does NEXiQ handle callers who switch from a 311 request to an emergency?",
          answer:
            "Any caller who indicates an emergency is immediately transferred to emergency dispatch without delay. NEXiQ is configured to detect urgency indicators throughout the call.",
        },
        {
          question: "Can we evaluate NEXiQ before committing to a full deployment?",
          answer:
            "Yes. The NexCort iQ free 60-day pilot program is available for qualified agencies and municipalities. Contact sales to discuss eligibility and configuration scope.",
        },
      ]}
      relatedLinks={[
        { href: "/nexiq", label: "NEXiQ — Non-Emergency Call Automation Overview" },
        { href: "/nexiq/savings-calculator", label: "NEXiQ Workload Savings Calculator" },
        { href: "/product/core", label: "NexCort iQ Core — 911 / PSAP Platform" },
        { href: "/free-60-day-pilot", label: "Apply for a Free 60-Day Pilot" },
        { href: "/contact-sales", label: "Talk with Sales About NEXiQ 311" },
      ]}
    />
  );
}
