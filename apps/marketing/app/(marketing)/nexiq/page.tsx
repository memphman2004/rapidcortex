import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/nexiq";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "NEXiQ — AI Non-Emergency Call Automation for Police & 311 | NexCort iQ",
  description:
    "NEXiQ automates police non-emergency lines and 311 services using conversational AI — reducing call volume, handling caller intake, and routing requests without replacing human staff.",
  path: PATH,
});

export default function NexiqPage() {
  return (
    <KeywordLandingPage
      title="NEXiQ — AI Non-Emergency Call Automation for Police & 311 | NexCort iQ"
      description="NEXiQ automates police non-emergency lines and 311 services using conversational AI — reducing call volume, handling caller intake, and routing requests without replacing human staff."
      path={PATH}
      h1="AI-Powered Non-Emergency Call Automation"
      eyebrow="NEXiQ — NexCort iQ"
      intro="NEXiQ is a conversational AI solution that handles police non-emergency calls, 311 city services, and municipal phone lines — reducing the call volume that reaches human dispatchers and staff, without touching 911 emergency operations."
      sections={[
        {
          title: "The non-emergency call volume problem",
          body: "In many agencies, 60–80% of calls to the police dispatch line are non-emergency: noise complaints, parking concerns, property damage reports, and general city information requests. Each of those calls consumes dispatcher time, delays emergency call pickup, and contributes to staffing pressure. NEXiQ addresses this workload without automating decisions that require human judgment.",
        },
        {
          title: "What NEXiQ handles",
          body: "NEXiQ uses Amazon Connect, Lex V2, Bedrock, and Polly to deliver a natural-sounding automated intake experience for callers on non-emergency lines.",
          bullets: [
            "Caller triage and intent recognition at the start of every call",
            "Automated information delivery for common requests (hours, locations, non-urgent status updates)",
            "Self-service intake for structured reports (noise, parking, minor property damage)",
            "Intelligent routing to the correct department or on-call officer when human handling is required",
            "Multilingual call handling — additional languages beyond English/Spanish are agency-configured",
            "Call summary and intake notes delivered to staff when routing to a human agent",
          ],
        },
        {
          title: "What NEXiQ never touches",
          body: "Emergency 911 calls are never intercepted, delayed, or routed through NEXiQ. The system operates exclusively on non-emergency and designated city-services lines. Any caller who indicates an emergency is immediately transferred or routed without automation.",
        },
        {
          title: "AI 311 and city services automation",
          body: "NEXiQ is also deployed as an AI-powered front end for municipal 311 services — handling city information requests, service status inquiries, and non-emergency report intake for departments including public works, sanitation, parks, and code enforcement. Cities can reduce their 311 call center staffing burden without eliminating the human tier for complex or sensitive inquiries.",
        },
        {
          title: "Integration and deployment",
          body: "NEXiQ integrates with existing phone line infrastructure through Amazon Connect. Deployment does not require replacing existing PBX systems, dispatch consoles, or records management software. Configuration for call flows, intake forms, routing rules, and language options is managed through the NexCort iQ admin console.",
        },
        {
          title: "Human oversight is preserved",
          body: "Every call that cannot be reliably handled by automation — including any caller who sounds distressed, confused, or indicates an urgent situation — is transferred to a human agent. NEXiQ is configured to err on the side of human handoff rather than attempting to handle edge cases automatically.",
        },
      ]}
      faq={[
        {
          question: "Does NEXiQ replace 911 dispatchers?",
          answer:
            "No. NEXiQ operates on non-emergency lines only. Human dispatchers handle all 911 calls. NEXiQ reduces non-emergency call volume so dispatchers can focus on emergency response.",
        },
        {
          question: "Can NEXiQ handle calls in languages other than English?",
          answer:
            "English and Spanish are available in the standard configuration. Additional languages can be configured for agencies with identified community needs.",
        },
        {
          question: "How does NEXiQ connect to our existing phone system?",
          answer:
            "NEXiQ uses Amazon Connect to handle inbound call routing. This can be integrated with existing phone infrastructure — your current dispatch console and telephony systems are not replaced.",
        },
        {
          question: "What happens if a non-emergency caller has an emergency?",
          answer:
            "Any caller who indicates an emergency during a NEXiQ-handled call is immediately transferred to emergency dispatch. The system is configured to detect distress indicators and route without delay.",
        },
        {
          question: "Can NEXiQ create intake reports that go into our existing records system?",
          answer:
            "NEXiQ can generate structured intake summaries. Integration with specific records management or CAD systems depends on the agency's existing software — discuss your specific environment during the pilot evaluation.",
        },
      ]}
      relatedLinks={[
        { href: "/ai-311", label: "AI 311 and Municipal Call Handling" },
        { href: "/product/core", label: "NexCort iQ Core — 911 / PSAP Platform" },
        { href: "/nexiq/savings-calculator", label: "NEXiQ Workload Savings Calculator" },
        { href: "/free-60-day-pilot", label: "Apply for a Free 60-Day Pilot" },
        { href: "/contact-sales", label: "Talk with Sales About NEXiQ" },
      ]}
    />
  );
}
