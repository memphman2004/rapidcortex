import type { CompetitorOutlineBody } from "rapid-cortex-shared";

export type CompetitorOutlineTopicId = CompetitorOutlineBody["topicId"];

export type CompetitorOutlineResult = {
  topicId: CompetitorOutlineTopicId;
  pageTitle: string;
  urlSlug: string;
  metaDescription: string;
  h1: string;
  sectionHeadings: string[];
  faq: { q: string; a: string }[];
  cta: string;
  schemaRecommendation: string;
};

const outlines = {
  "rapid-cortex-vs-legacy-cad": {
    topicId: "rapid-cortex-vs-legacy-cad",
    pageTitle: "Rapid Cortex vs legacy CAD workflows | Ops-ready intelligence",
    urlSlug: "/compare/rapid-cortex-vs-legacy-cad-workflows",
    metaDescription:
      "Compare Rapid Cortex with legacy CAD-centric workflows: transcription quality, structured intelligence, QA, and measurable dispatcher outcomes.",
    h1: "Rapid Cortex vs legacy CAD workflows",
    sectionHeadings: [
      "Where legacy CAD workflows break down operationally",
      "Structured intelligence vs note-taking",
      "CAD integrations without ripping out dispatch fundamentals",
      "Security, auditability, and CJIS-minded controls",
      "Migration path: pilot → scale",
    ],
    faq: [
      {
        q: "Do we replace our CAD?",
        a: "No—this comparison focuses on augmenting dispatcher workflows with intelligence layers that interoperate with CAD rather than replacing core CAD records.",
      },
      {
        q: "What improves first in a pilot?",
        a: "Teams typically see faster information retrieval, fewer missed details in complex calls, and cleaner QA feedback loops.",
      },
    ],
    cta: "Book a workflow review with our team",
    schemaRecommendation: "FAQPage + SoftwareApplication (pair FAQPage mainEntity with product positioning)",
  },
  "rapid-cortex-vs-ng911-media-only": {
    topicId: "rapid-cortex-vs-ng911-media-only",
    pageTitle: "Rapid Cortex vs NG911 media-only tools | Decision support beyond video",
    urlSlug: "/compare/rapid-cortex-vs-ng911-media-only-tools",
    metaDescription:
      "Contrast Rapid Cortex decision-support intelligence with media-only NG911 tooling—coverage across voice, text, QA, and operational workflows.",
    h1: "Rapid Cortex vs NG911 media-only tools",
    sectionHeadings: [
      "Media capture vs operational intelligence",
      "Voice + chat + attachments in one timeline",
      "Supervisor QA and coaching loops",
      "Reliability, retention, and governance",
    ],
    faq: [
      {
        q: "Is this only about video?",
        a: "No—Rapid Cortex emphasizes unified incident intelligence across modalities, not only media playback.",
      },
    ],
    cta: "See a unified incident intelligence demo",
    schemaRecommendation: "FAQPage + Product",
  },
  "rc-lite-api-cad-vendors": {
    topicId: "rc-lite-api-cad-vendors",
    pageTitle: "RC Lite API for CAD vendors | Secure hooks into Rapid Cortex intelligence",
    urlSlug: "/platform/rc-lite-api-for-cad-vendors",
    metaDescription:
      "Technical overview for CAD vendors: RC Lite API patterns, tenancy boundaries, operational safeguards, and integration milestones.",
    h1: "RC Lite API for CAD vendors",
    sectionHeadings: [
      "Why vendors integrate RC Lite",
      "Authentication, tenancy, and least privilege",
      "Recommended integration milestones",
      "Operational monitoring and support expectations",
    ],
    faq: [
      {
        q: "What is RC Lite?",
        a: "RC Lite is a vendor-facing API surface for integrating external systems with Rapid Cortex capabilities using scoped credentials.",
      },
    ],
    cta: "Request vendor integration documentation",
    schemaRecommendation: "SoftwareApplication + BreadcrumbList",
  },
  "emergency-response-intelligence": {
    topicId: "emergency-response-intelligence",
    pageTitle: "Emergency response intelligence software | From audio to actionable clarity",
    urlSlug: "/solutions/emergency-response-intelligence-software",
    metaDescription:
      "Define emergency response intelligence: real-time capture, structured summaries, QA, supervisor workflows, and audit-friendly outputs.",
    h1: "Emergency response intelligence software",
    sectionHeadings: [
      "What intelligence means in dispatch operations",
      "Capture → structure → QA → improvement loops",
      "Cross-team alignment (ops, IT, compliance)",
      "Outcome metrics that leadership can trust",
    ],
    faq: [
      {
        q: "How is this different from transcription?",
        a: "Transcription is an input; intelligence includes structuring, QA scoring, decision-support surfacing, and audit trails.",
      },
    ],
    cta: "Talk to solutions engineering",
    schemaRecommendation: "Organization + Article",
  },
  "911-dispatcher-decision-support": {
    topicId: "911-dispatcher-decision-support",
    pageTitle: "911 dispatcher decision-support software | Faster clarity under pressure",
    urlSlug: "/solutions/911-dispatcher-decision-support-software",
    metaDescription:
      "Explain dispatcher decision-support: prioritized cues, structured summaries, supervisor oversight, and measurable quality improvements.",
    h1: "911 dispatcher decision-support software",
    sectionHeadings: [
      "Decision-support vs clutter",
      "What dispatchers need in the first 60 seconds",
      "Supervisor coaching grounded in evidence",
      "Safety, accuracy, and governance",
    ],
    faq: [
      {
        q: "Does this automate dispatch decisions?",
        a: "No—it augments humans with structured context and QA workflows; agencies retain operational authority.",
      },
    ],
    cta: "Schedule a dispatcher-centered demo",
    schemaRecommendation: "FAQPage + SoftwareApplication",
  },
} satisfies Record<CompetitorOutlineTopicId, CompetitorOutlineResult>;

export function getCompetitorOutline(topicId: CompetitorOutlineTopicId): CompetitorOutlineResult {
  return outlines[topicId];
}
