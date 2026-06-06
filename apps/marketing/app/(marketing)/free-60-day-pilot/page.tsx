import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/free-60-day-pilot";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Free 60-Day Pilot for 911 Centers & PSAPs | Rapid Cortex",
  description:
    "Qualified agencies and public safety operations teams can evaluate Rapid Cortex through a free 60-day pilot with non-disruptive deployment and no CAD replacement required.",
  path: PATH,
});

export default function FreePilotPage() {
  return (
    <KeywordLandingPage
      title="Free 60-Day Pilot for 911 Centers & PSAPs | Rapid Cortex"
      description="Qualified agencies and public safety operations teams can evaluate Rapid Cortex through a free 60-day pilot with non-disruptive deployment and no CAD replacement required."
      path={PATH}
      h1="Free 60-Day Pilot Program"
      eyebrow="free 60-day pilot"
      intro="Rapid Cortex offers qualified agencies and operations teams a Free 60-Day Pilot Program to evaluate decision support and operational awareness in real workflows."
      sections={[
        {
          title: "Designed for non-disruptive evaluation",
          body: "Pilot deployments are structured to complement existing CAD, NG911, telephony, and emergency management systems.",
        },
        {
          title: "Pilot scope can include",
          body: "Agencies can evaluate core capabilities tied to operational outcomes.",
          bullets: [
            "Live call transcription support",
            "Multilingual communication workflows",
            "Secure caller text, photo, video, and location intake",
            "Supervisor visibility and continuity logs",
            "CAD-friendly integration validation",
          ],
        },
        {
          title: "Who can participate",
          body: "The program supports 911 centers, PSAPs, emergency communications teams, emergency management agencies, airports, universities, stadiums, and public safety operations centers.",
        },
        {
          title: "No CAD replacement required",
          body: "Rapid Cortex is deployed as an intelligence and decision-support layer, not a replacement for systems of record.",
        },
      ]}
      relatedLinks={[
        { href: "/ng911-software", label: "NG911 Software Intelligence Layer" },
        { href: "/cad-integration", label: "CAD Integration for 911 Centers" },
        { href: "/public-safety-intelligence", label: "Public Safety Intelligence Platform" },
        { href: "/contact-sales", label: "Talk with Sales About Pilot Eligibility" },
      ]}
    />
  );
}
