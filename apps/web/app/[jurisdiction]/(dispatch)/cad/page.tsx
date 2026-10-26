"use client";

import { useSearchParams } from "next/navigation";
import { CadConsoleGate } from "@/components/dispatch/cad-console-gate";

export default function CadWorkspacePage() {
  const sp = useSearchParams();
  const incidentId = sp.get("incident")?.trim() || null;
  return <CadConsoleGate incidentId={incidentId} />;
}
