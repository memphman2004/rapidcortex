"use client";

import { useSearchParams } from "next/navigation";
import { CadEntryWorkspace } from "@/components/dispatch/cad-entry-workspace";

export default function CadWorkspacePage() {
  const sp = useSearchParams();
  const incidentId = sp.get("incident")?.trim() || null;
  return <CadEntryWorkspace incidentId={incidentId} />;
}
