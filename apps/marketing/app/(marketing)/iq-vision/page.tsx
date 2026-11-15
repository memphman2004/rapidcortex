import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/iq-vision";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "iQ Vision — AI Security Camera Intelligence for Safety Operations | NexCort iQ",
  description:
    "iQ Vision uses AI to generate real-time observations from security camera streams, helping safety teams detect and respond to incidents without replacing existing camera infrastructure.",
  path: PATH,
});

export default function IqVisionPage() {
  return (
    <KeywordLandingPage
      title="iQ Vision — AI Security Camera Intelligence for Safety Operations | NexCort iQ"
      description="iQ Vision uses AI to generate real-time observations from security camera streams, helping safety teams detect and respond to incidents without replacing existing camera infrastructure."
      path={PATH}
      h1="AI Scene Intelligence for Security Operations"
      eyebrow="iQ Vision — NexCort iQ"
      intro="iQ Vision is an AI-powered scene intelligence layer that works alongside existing security camera infrastructure, generating structured observations and incident notifications for security operations centers, campus safety teams, and venue security staff."
      sections={[
        {
          title: "The limits of human camera monitoring",
          body: "Security operations centers routinely monitor dozens or hundreds of camera feeds simultaneously. No human team can maintain full attention across every feed at all times. iQ Vision is designed to serve as an AI observer that generates structured scene observations — giving human operators faster context for incidents already in progress and reducing the time between an event occurring and a human response beginning.",
        },
        {
          title: "How iQ Vision works",
          body: "iQ Vision analyzes video streams from connected cameras using AI detection models to identify scene activity that may warrant security attention.",
          bullets: [
            "Real-time AI observation generation from camera streams",
            "Structured incident notifications delivered to authorized security staff",
            "Live transcript intelligence from video audio streams",
            "Incident-linked observation history for review and documentation",
            "Viewer access for authorized security personnel with appropriate role-based access",
            "Integration with existing camera infrastructure — no hardware replacement required",
          ],
        },
        {
          title: "What iQ Vision is and is not",
          body: "iQ Vision provides AI-generated observations — not autonomous decisions. It surfaces scene information to security staff, who make all response decisions. iQ Vision does not automatically dispatch responders, lock doors, or trigger physical security systems. It is an intelligence layer, not an automated enforcement system.",
        },
        {
          title: "Campus safety applications",
          body: "Campus security teams can connect iQ Vision to Blue Light poles, parking structures, residence hall entrances, and other fixed camera points. Observations generated during a Blue Light activation appear alongside incident details in the campus console, giving dispatch and responding officers relevant scene context before arrival.",
        },
        {
          title: "Venue and stadium applications",
          body: "Venue security operations can use iQ Vision to extend the effective reach of a fixed security team during large events. Rather than staffing every camera position with a dedicated observer, iQ Vision generates scene summaries for areas of interest, allowing the security center to triage response resources more effectively.",
        },
        {
          title: "Deployment and camera compatibility",
          body: "iQ Vision connects to camera streams via Kinesis Video Streams and standard RTSP/HLS inputs. Deployment depends on camera configuration and network architecture. Camera replacement is not required. The AI processing layer is hosted on AWS and does not require on-premise hardware.",
        },
      ]}
      faq={[
        {
          question: "Does iQ Vision automatically alert police or dispatch responders?",
          answer:
            "No. iQ Vision generates AI observations and delivers them to authorized security staff. Human personnel make all response decisions. No automatic dispatch occurs without human review.",
        },
        {
          question: "What cameras does iQ Vision work with?",
          answer:
            "iQ Vision supports camera systems that can stream via RTSP or HLS. Specific compatibility depends on your camera network configuration. Contact sales to discuss your existing camera infrastructure during evaluation.",
        },
        {
          question: "Can iQ Vision be used without replacing our existing VMS?",
          answer:
            "Yes. iQ Vision is an AI observation layer, not a video management system replacement. It is designed to complement existing VMS platforms.",
        },
        {
          question: "Who can view iQ Vision observations?",
          answer:
            "Access is controlled by role-based permissions within the NexCort iQ platform. Dispatchers, supervisors, and security staff can be granted viewer access appropriate to their role.",
        },
        {
          question: "Is iQ Vision available for 911 / PSAP centers?",
          answer:
            "iQ Vision capabilities are available to 911 centers and PSAPs through the NexCort iQ Core platform. Campus, venue, and transit verticals also have access.",
        },
      ]}
      relatedLinks={[
        { href: "/product/core", label: "NexCort iQ Core — 911 / PSAP Platform" },
        { href: "/campus-safety-software", label: "NexCort iQ Campus Safety" },
        { href: "/venue-safety-software", label: "NexCort iQ Venue Security" },
        { href: "/free-60-day-pilot", label: "Apply for a Free 60-Day Pilot" },
        { href: "/contact-sales", label: "Talk with Sales About iQ Vision" },
      ]}
    />
  );
}
