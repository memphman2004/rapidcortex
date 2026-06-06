export type MarketingAddon = {
  name: string;
  description: string;
};

export const ADDONS: MarketingAddon[] = [
  {
    name: "Advanced AI Triage",
    description: "Configurable AI-assisted triage support for faster dispatcher context and prioritization",
  },
  {
    name: "Live Translation",
    description: "Real-time language translation support for 125+ languages during emergency calls",
  },
  {
    name: "Enhanced Transcription",
    description: "Higher-accuracy transcription with speaker-aware options for critical incident records",
  },
  {
    name: "CAD Integration",
    description: "CAD-aligned read and write workflows for operational continuity with existing systems",
  },
  {
    name: "Caller Media",
    description: "Secure intake of caller photos, videos, and live media links during active incidents",
  },
  {
    name: "Supervisor QA",
    description: "Review, coaching, and quality workflows for dispatcher performance and compliance",
  },
  {
    name: "Incident Command",
    description: "Command-level coordination tools for major incidents, timelines, and stakeholder updates",
  },
  {
    name: "Reliability Operations",
    description: "Operational health, escalation, and reporting capabilities for high-availability deployments",
  },
  {
    name: "Hospital Routing",
    description: "Hospital-specific routing and diversion coordination features for medical surge events",
  },
  {
    name: "Campus Safety Intelligence",
    description: "Campus-focused incident coordination and communications intelligence for education environments",
  },
];

