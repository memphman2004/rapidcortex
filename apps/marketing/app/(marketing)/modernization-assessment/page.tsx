import type { Metadata } from "next";
import { buildPublicPageMetadata } from "@/lib/seo";
import { ReadinessAssessment } from "@/components/assessment/readiness-assessment";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "911 Modernization Readiness Assessment | NexCort iQ",
  description:
    "Answer 8 questions about your 911 center's current situation and get matched with relevant NexCort iQ capabilities. Free, non-binding, no account required.",
  path: "/modernization-assessment",
});

export default function ModernizationAssessmentPage() {
  return (
    <div className="min-h-screen bg-[#060d1a]">
      <ReadinessAssessment />
    </div>
  );
}
