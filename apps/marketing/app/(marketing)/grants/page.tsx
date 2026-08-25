import type { Metadata } from "next";
import { GrantsLanding } from "@/components/marketing/grants-landing";
import { buildPublicPageMetadata } from "@/lib/seo";

const PATH = "/grants";

export const metadata: Metadata = buildPublicPageMetadata({
  title: "Grant Success Program — Rapid Cortex",
  description:
    "Free AI-powered grant writing for 911 centers and public safety agencies. " +
    "Rapid Cortex generates complete, ready-to-submit grant applications for COPS, " +
    "NG911, Byrne JAG, ARPA, and more — included at no additional cost.",
  path: PATH,
  keywords: [
    "911 grant writing",
    "COPS Technology Program",
    "NG911 grant",
    "Byrne JAG",
    "public safety grants",
    "PSAP funding",
  ],
});

export default function GrantsPage() {
  return <GrantsLanding />;
}
