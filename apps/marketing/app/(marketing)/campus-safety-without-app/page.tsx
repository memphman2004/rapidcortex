import type { Metadata } from "next";
import { KeywordLandingPage } from "@/components/marketing/seo/keyword-landing-page";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/campus-safety-without-app";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Campus Safety Reporting Without a Mobile App | NexCort iQ",
  description:
    "NexCort iQ Campus enables emergency reporting via QR codes and NFC taps — no app download required. Students and visitors scan a code or tap a device to report incidents instantly.",
  path: PATH,
});

export default function CampusSafetyWithoutAppPage() {
  return (
    <KeywordLandingPage
      title="Campus Safety Reporting Without a Mobile App | NexCort iQ"
      description="NexCort iQ Campus enables emergency reporting via QR codes and NFC taps — no app download required. Students and visitors scan a code or tap a device to report incidents instantly."
      path={PATH}
      h1="Campus Safety Reporting Without a Mobile App"
      eyebrow="NexCort iQ Campus"
      intro="Campus safety apps solve a real problem — but only when people have them installed. Most students don't download safety apps until they need one, which is too late. NexCort iQ Campus enables instant emergency and safety reporting through QR codes and NFC taps built directly into existing campus infrastructure, with no app installation required."
      sections={[
        {
          title: "The app adoption problem",
          body: "Campus safety mobile apps provide valuable features, but adoption rates at most institutions remain low. Installation rates of 15–25% mean the majority of the campus community cannot use the reporting system in an emergency. QR and NFC reporting removes this barrier — the reporting interface opens directly in the device's native browser, with no prior installation or account required.",
        },
        {
          title: "How QR and NFC campus reporting works",
          body: "NexCort iQ Campus places QR codes and NFC tags at key campus locations: buildings, parking structures, athletic facilities, residence halls, transit stops, and emergency poles.",
          bullets: [
            "Student or visitor scans a QR code or taps an NFC-enabled device",
            "Browser opens an incident reporting form immediately — no app download, no login",
            "Caller provides their location, situation type, and optional photo or description",
            "Report is delivered to campus dispatch and security in real time",
            "Campus dispatch can initiate Two-Way Text communication with the reporting party",
            "Responding officers receive incident details and optional location before arrival",
          ],
        },
        {
          title: "Blue Light Connect integration",
          body: "NexCort iQ Campus integrates with Blue Light emergency pole systems. When a Blue Light pole is activated, the incident automatically appears in the campus dispatch console alongside AI-generated scene observations (where camera feeds are available) and the pole's registered location. Campus security receives immediate notification with actionable context.",
        },
        {
          title: "Who can use it",
          body: "QR and NFC reporting is designed to be accessible to anyone on campus — students, faculty, staff, event visitors, and contractors — with no prior registration, training, or account setup. The reporting flow is intentionally brief and usable under stress.",
        },
        {
          title: "Campus dispatch console",
          body: "NexCort iQ Campus provides campus dispatch and security staff with a dedicated operations console that consolidates incoming reports, active incidents, responder locations, and AI-assisted situational awareness. The console is distinct from 911 / PSAP tools and does not interfere with or route to emergency 911 services.",
        },
        {
          title: "Deployment alongside existing campus systems",
          body: "NexCort iQ Campus is deployed as a complementary layer. It does not replace existing campus police CAD, emergency notification platforms, or mass-notification systems. QR codes and NFC tags can be added to existing emergency poles, building signage, and facilities infrastructure without structural modification.",
        },
      ]}
      faq={[
        {
          question: "Does the reporter need to be registered in the system?",
          answer:
            "No. QR and NFC reporting is anonymous by default. Reporters provide location, situation type, and optional contact information if they choose to — no prior account or registration is required.",
        },
        {
          question: "Can our existing Blue Light poles work with NexCort iQ?",
          answer:
            "NexCort iQ Campus supports Blue Light Connect integration for poles that can send activation events via webhook or SIP. Contact sales to evaluate compatibility with your existing pole vendor.",
        },
        {
          question: "Does QR/NFC reporting replace calling 911?",
          answer:
            "No. QR and NFC reporting is a complementary channel designed for situations where a text-based report is appropriate and for pre-incident or non-emergency safety reporting. Callers who need immediate emergency help are always directed to call 911.",
        },
        {
          question: "What happens to a submitted report if no dispatcher is logged in?",
          answer:
            "Reports are captured and stored regardless of dispatcher availability. Notifications are sent to configured on-call contacts. No reports are silently dropped.",
        },
        {
          question: "Is NexCort iQ Campus a Clery Act compliance tool?",
          answer:
            "NexCort iQ Campus supports incident documentation that may assist with Clery Act reporting workflows. It does not automatically certify compliance or replace your institution's formal Clery process and legal review. Consult your compliance team.",
        },
      ]}
      relatedLinks={[
        { href: "/campus-safety-software", label: "NexCort iQ Campus — Full Platform Overview" },
        { href: "/product/campus", label: "Campus Safety Product Details" },
        { href: "/campus-safety-integrations", label: "Campus Safety Integrations" },
        { href: "/iq-vision", label: "iQ Vision — AI Camera Intelligence" },
        { href: "/free-60-day-pilot", label: "Apply for a Free 60-Day Pilot" },
        { href: "/contact-sales", label: "Talk with Sales About Campus Safety" },
      ]}
    />
  );
}
