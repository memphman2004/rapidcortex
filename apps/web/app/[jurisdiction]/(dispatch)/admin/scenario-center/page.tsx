import { ScenarioCenter } from "@/components/demo/ScenarioCenter";
import { requireRole } from "@/lib/auth/require-role";
import { isScenarioCenterUiEnabled } from "@/lib/runtime-flags";
import { notFound } from "next/navigation";

export default async function AgencyScenarioCenterPage() {
  await requireRole(["agencyadmin", "rcsuperadmin", "rcadmin"]);
  if (!isScenarioCenterUiEnabled()) notFound();
  return (
    <div className="p-4 md:p-6">
      <ScenarioCenter />
    </div>
  );
}
