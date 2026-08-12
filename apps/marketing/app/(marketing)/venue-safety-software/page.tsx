import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/venue-safety-software";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Venue Safety Software for Stadiums & Events | Rapid Cortex",
  description:
    "Venue safety software for stadiums, arenas, and large events. Guests report by QR or SMS; security teams run a live operations dashboard — without replacing radios, cameras, or 911.",
  path: PATH,
  keywords: [
    "venue safety software",
    "event security platform",
    "stadium incident reporting",
    "arena security software",
    "venue operations dashboard",
  ],
});

export default function VenueSafetySoftwarePage() {
  return (
    <KeywordLandingPage
      title="Venue Safety Software for Stadiums & Events | Rapid Cortex"
      description="Venue safety software for stadiums, arenas, and large events. Guests report by QR or SMS; security teams run a live operations dashboard — without replacing radios, cameras, or 911."
      path={PATH}
      h1="Venue Safety Software for Stadiums, Arenas, and Events"
      eyebrow="Venue safety software"
      intro="Rapid Cortex Venue is an event security platform that lets guests report from any zone and gives security a single operations view. It enhances venue operations. It does not replace venue security, radios, camera systems, or 911."
      sections={[
        {
          title: "The event-day information gap",
          body: "A guest in Section 124 who needs medical help, or a staffer who spots a crowd issue two concourses away, often has no fast path to the SOC. Radio chatter and paper logs leave supervisors reconstructing the picture after the moment has passed.",
        },
        {
          title: "Capabilities for venue and event security",
          body: "Rapid Cortex Venue adds QR/SMS intake and a zone-based dashboard on top of the command structure you already run.",
          bullets: [
            "QR and NFC signs at gates, sections, and concourses — no guest app required",
            "SMS reporting with venue code and location parsed into a tracked incident",
            "Live security dashboard with zone, media, and nearby camera references",
            "Assignment, incident chat, and optional escalation to emergency communications",
            "Post-event reporting for after-action reviews",
          ],
        },
        {
          title: "Venue and stadium integrations",
          body: "Wire consent-based cameras, QR/SMS reporting, and SOC workflows so command staff see reports next to the cameras that matter. Adapter maturity varies and is validated per contract.",
        },
        {
          title: "Operations notes",
          body: "Deployments are scoped by zones, concurrent users, and event calendar. Retention and role access are configured by the venue. Rapid Cortex is not a substitute for your security contractor, medical vendor, or public-safety mutual-aid agreements.",
        },
        {
          title: "What Rapid Cortex does not replace",
          body: "Venue security teams, radio systems, existing CCTV, and 911 remain the systems of record for response. Rapid Cortex is incident intake and operational awareness — not a 911 emergency dispatch system.",
        },
      ]}
      relatedLinks={[
        { href: "/product/venue", label: "Rapid Cortex Venue product" },
        { href: "/venue", label: "Venue safety intelligence" },
        { href: "/venue-safety-integrations", label: "Venue safety integrations" },
        { href: "/stadium-security-software", label: "Stadium security software" },
        { href: "/integrations", label: "Integrations overview" },
        { href: "/free-60-day-pilot", label: "Free 60-Day Pilot Program" },
        { href: "/blog/rapid-cortex-venue", label: "Blog: Rapid Cortex Venue" },
        { href: "/blog/stadium-fan-safety-without-adding-staff", label: "Blog: Stadium fan safety without adding staff" },
        { href: "/blog/airport-incident-reporting-platform", label: "Blog: Airport incident reporting" },
      ]}
      faq={[
        {
          question: "Does venue safety software replace 911 or venue security?",
          answer:
            "No. Rapid Cortex Venue is not a 911 emergency dispatch system. It does not replace venue security, radios, cameras, or medical direction.",
        },
        {
          question: "How do guests report without downloading an app?",
          answer:
            "Guests scan a posted QR/NFC sign or text a venue code and location to the Rapid Cortex safety number. Reports land on the security dashboard with zone and media.",
        },
        {
          question: "Can we pilot venue safety software before a full season?",
          answer:
            "Yes. Qualified venues can evaluate Rapid Cortex through a Free 60-Day Pilot with QR reporting, SMS reporting, and a guided operations dashboard.",
        },
      ]}
    />
  );
}
