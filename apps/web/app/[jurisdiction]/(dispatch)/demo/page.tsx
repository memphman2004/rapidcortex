import { notFound } from "next/navigation";
import { DemoRunner } from "@/components/dispatch/demo-runner";
import { isDemoScriptedContentEnabled } from "@/lib/deployment-environment";

export default function DemoPage() {
  if (!isDemoScriptedContentEnabled()) {
    notFound();
  }
  return <DemoRunner />;
}
