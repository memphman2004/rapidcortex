import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/transit-safety-software";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Transit Safety Management Software | NexCort iQ",
  description:
    "NexCort iQ Transit helps transit agencies manage safety incidents, coordinate security staff, and maintain operational awareness across distributed bus, rail, and transit networks.",
  path: PATH,
});

export default function TransitSafetySoftwarePage() {
  return (
    <KeywordLandingPage
      title="Transit Safety Management Software | NexCort iQ"
      description="NexCort iQ Transit helps transit agencies manage safety incidents, coordinate security staff, and maintain operational awareness across distributed bus, rail, and transit networks."
      path={PATH}
      h1="Transit Safety Management Software"
      eyebrow="NexCort iQ Transit"
      intro="NexCort iQ Transit is a safety operations platform built for transit agencies — providing incident management, security coordination, and operational awareness across distributed transit networks, without replacing existing dispatch or operations control systems."
      sections={[
        {
          title: "Safety operations across a distributed network",
          body: "Transit safety is inherently distributed. Incidents happen on vehicles, at stations, in parking facilities, and along route corridors — not in a central location where a single team can directly observe them. NexCort iQ Transit provides a common incident picture for transit security directors, supervisors, and operations staff regardless of where events occur.",
        },
        {
          title: "Incident reporting and coordination",
          body: "Transit security and operations staff can report incidents from mobile devices, kiosks, or desktop interfaces without leaving the field or returning to a central console.",
          bullets: [
            "Mobile-accessible incident reporting for field security officers",
            "QR and NFC incident reporting points at stations and facilities",
            "Real-time incident status visible to supervisors and operations centers",
            "Security staff coordination and task assignment during incidents",
            "Incident documentation and audit trail for after-action review",
            "Notifications to appropriate staff when incidents escalate or require additional response",
          ],
        },
        {
          title: "Supervisor and operations visibility",
          body: "Transit security supervisors and operations managers can monitor incident activity across the network in real time. Supervisors can review open incidents, track staff assignments, and coordinate response without being physically present at every location.",
        },
        {
          title: "AI-assisted situational awareness",
          body: "Where camera infrastructure is available, iQ Vision can extend transit security visibility by generating AI observations from video streams at stations and facilities. This complements the incident reporting platform with scene-level intelligence for security operations.",
        },
        {
          title: "Deployment alongside existing transit operations",
          body: "NexCort iQ Transit is deployed as a complementary intelligence and coordination layer. It does not replace existing control centers, Computer-Aided Dispatch systems, or transit operations management platforms. Transit agencies can configure the platform to match their reporting hierarchy, incident categories, and notification requirements.",
        },
      ]}
      faq={[
        {
          question: "Does NexCort iQ Transit replace our existing transit operations system?",
          answer:
            "No. NexCort iQ Transit is designed to complement existing operations. It provides incident reporting, security coordination, and visibility capabilities alongside your current transit management and dispatch infrastructure.",
        },
        {
          question: "Can transit passengers use the platform to report incidents?",
          answer:
            "QR code reporting points can be configured at stations and vehicles for passenger-initiated reports. Configuration depends on the deployment setup and your agency's policies for public reporting.",
        },
        {
          question: "What transit security roles are supported?",
          answer:
            "NexCort iQ Transit supports Transit Admin, Transit Supervisor, Transit Security, and Transit Operator role levels, each with appropriate access to incident data, reporting tools, and operational visibility.",
        },
        {
          question: "Is NexCort iQ Transit available for pilot evaluation?",
          answer:
            "Yes. The free 60-day pilot program is available for qualified transit agencies. Contact sales to discuss your agency's specific requirements and timeline.",
        },
      ]}
      relatedLinks={[
        { href: "/product/transit", label: "NexCort iQ Transit — Product Overview" },
        { href: "/iq-vision", label: "iQ Vision — AI Camera Intelligence" },
        { href: "/campus-safety-software", label: "NexCort iQ Campus Safety" },
        { href: "/free-60-day-pilot", label: "Apply for a Free 60-Day Pilot" },
        { href: "/contact-sales", label: "Talk with Sales About Transit Safety" },
      ]}
    />
  );
}
