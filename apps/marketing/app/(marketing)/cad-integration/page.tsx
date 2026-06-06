import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/cad-integration";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "CAD Integration for 911 Centers | Rapid Cortex",
  description:
    "Rapid Cortex works alongside existing CAD and NG911 systems to support emergency communications teams with operational intelligence, real-time assistance, and incident visibility.",
  path: PATH,
});

export default function CadIntegrationPage() {
  return (
    <KeywordLandingPage
      title="CAD Integration for 911 Centers | Rapid Cortex"
      description="Rapid Cortex works alongside existing CAD and NG911 systems to support emergency communications teams with operational intelligence, real-time assistance, and incident visibility."
      path={PATH}
      h1="CAD-Friendly Integration for 911 Centers"
      eyebrow="CAD integration for 911 centers"
      intro="Rapid Cortex is not a CAD replacement. It provides an intelligence and decision-support layer that fits existing CAD, NG911, telephony, and emergency management environments."
      sections={[
        {
          title: "Protect your current systems of record",
          body: "Rapid Cortex is designed to complement, not replace, established dispatch infrastructure and workflows.",
        },
        {
          title: "Operational support during incidents",
          body: "Agencies can add real-time assistance while keeping CAD workflows intact.",
          bullets: [
            "Live call transcription support",
            "Secure caller text, photo, video, and location intake",
            "Supervisor visibility and continuity logs",
            "Incident intelligence for decision support",
          ],
        },
        {
          title: "Built for public safety use cases",
          body: "The platform supports 911 centers, PSAPs, emergency communications teams, emergency management agencies, and regional operations centers.",
        },
        {
          title: "Non-disruptive rollout path",
          body: "Teams can evaluate value through phased deployment and a Free 60-Day Pilot Program.",
        },
      ]}
      relatedLinks={[
        { href: "/ng911-software", label: "NG911 Software Intelligence Layer" },
        { href: "/911-dispatch-software", label: "911 Dispatch Intelligence Software" },
        { href: "/psap-software", label: "PSAP Software for Operational Awareness" },
        { href: "/free-60-day-pilot", label: "Free 60-Day Pilot Program" },
      ]}
    />
  );
}
