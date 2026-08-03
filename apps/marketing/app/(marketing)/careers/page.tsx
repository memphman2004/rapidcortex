import type { Metadata } from "next";
import { CareersJobsClient } from "@/components/careers/careers-jobs-client";
import { buildPublicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Careers | Jobs at Rapid Cortex",
  description:
    "Browse open roles at Rapid Cortex. Click a job to view the full description and apply — including Executive Assistant / Startup Operations Coordinator.",
  path: "/careers",
});

export default function CareersPage() {
  return <CareersJobsClient />;
}
