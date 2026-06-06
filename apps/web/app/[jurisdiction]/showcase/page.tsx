import type { Metadata } from "next";
import { RapidCortexShowcaseDashboard } from "@/components/showcase/rapid-cortex-showcase-dashboard";

export const metadata: Metadata = {
  title: "Showcase · Rapid Cortex",
  description: "Public sales and UX validation dashboard (demo scenarios, no sign-in).",
};

export default function ShowcasePage() {
  return <RapidCortexShowcaseDashboard />;
}
