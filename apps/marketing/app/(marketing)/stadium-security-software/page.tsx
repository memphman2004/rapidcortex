import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/stadium-security-software";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Stadium & Arena Security Software | Rapid Cortex",
  description:
    "Stadium security software for arenas and large venues. Zone-based incident reporting, QR/SMS guest intake, and SOC visibility — alongside existing cameras and radios, not instead of them.",
  path: PATH,
  keywords: [
    "stadium security software",
    "arena security software",
    "stadium incident reporting",
    "SOC operations dashboard",
    "fan safety platform",
  ],
});

export default function StadiumSecuritySoftwarePage() {
  return (
    <KeywordLandingPage
      title="Stadium & Arena Security Software | Rapid Cortex"
      description="Stadium security software for arenas and large venues. Zone-based incident reporting, QR/SMS guest intake, and SOC visibility — alongside existing cameras and radios, not instead of them."
      path={PATH}
      h1="Stadium and Arena Security Software"
      eyebrow="Stadium security software"
      intro="Rapid Cortex Venue gives stadium and arena command staff a zone-based view of guest and staff reports. It sits beside your SOC cameras and radios. It is not a 911 emergency dispatch system and does not replace security contractors or medical direction."
      sections={[
        {
          title: "Game-day and concert-night coordination",
          body: "Seventy thousand fans and a radio net that is already full is a visibility problem, not a headcount problem. Supervisors need structured reports from the bowl, concourse, and gates without asking guests to install an app.",
        },
        {
          title: "Capabilities for stadium command",
          body: "Posted codes and a live dashboard give the SOC the same incident context the usher just saw.",
          bullets: [
            "Section- and gate-level QR/NFC reporting",
            "SMS intake parsed to venue, zone, and message",
            "SOC dashboard with nearby camera references",
            "Assignment and incident chat for roaming teams",
            "Optional escalation path to emergency communications when policy requires it",
          ],
        },
        {
          title: "Camera and SOC integrations",
          body: "Consent-based Ring and Nest Connect flows, plus venue camera references, help command staff jump from a report to the right feed. Adapters are validated per venue contract — maturity varies by stack.",
        },
        {
          title: "Operations notes",
          body: "Scoped by bowl zones, concurrent operator seats, and event calendar. After-action exports support post-event reviews. Rapid Cortex does not operate your CCTV matrix, access control, or public-address system.",
        },
        {
          title: "What Rapid Cortex does not replace",
          body: "Stadium security, law enforcement details, EMS, and 911 stay in command of response. Rapid Cortex improves how reports reach the SOC. It does not dispatch public safety units or provide medical direction.",
        },
      ]}
      relatedLinks={[
        { href: "/product/venue", label: "Rapid Cortex Venue product" },
        { href: "/venue", label: "Venue safety intelligence" },
        { href: "/venue-safety-software", label: "Venue safety software" },
        { href: "/venue-safety-integrations", label: "Venue safety integrations" },
        { href: "/integrations", label: "Integrations overview" },
        { href: "/free-60-day-pilot", label: "Free 60-Day Pilot Program" },
        { href: "/blog/stadium-fan-safety-without-adding-staff", label: "Blog: Stadium fan safety without adding staff" },
        { href: "/blog/rapid-cortex-venue", label: "Blog: Rapid Cortex Venue" },
        { href: "/blog/stadium-safety-text-reporting", label: "Blog: Stadium safety text reporting" },
      ]}
      faq={[
        {
          question: "Is this a 911 dispatch system for stadiums?",
          answer:
            "No. Rapid Cortex Venue is stadium security software for guest reporting and SOC awareness. It does not replace 911, law enforcement details, or medical direction.",
        },
        {
          question: "Will it work with our existing stadium cameras?",
          answer:
            "Reports can include nearby camera references and optional consent-based Ring or Nest Connect flows. Native CCTV matrix control stays with your existing video system.",
        },
        {
          question: "Can we trial stadium security software on a single event?",
          answer:
            "Qualified venues can start with a Free 60-Day Pilot covering QR/SMS reporting and the operations dashboard before a full-season rollout.",
        },
      ]}
    />
  );
}
