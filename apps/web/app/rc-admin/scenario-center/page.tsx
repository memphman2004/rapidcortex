import { ScenarioCenter } from "@/components/demo/ScenarioCenter";
import { requireRole } from "@/lib/auth/require-role";
import { isScenarioCenterUiEnabled } from "@/lib/runtime-flags";
import { notFound } from "next/navigation";

export const metadata = {
  title: "Scenario Center",
  robots: { index: false, follow: false },
};

export default async function RcAdminScenarioCenterPage() {
  await requireRole(["rcsuperadmin", "rcadmin"]);
  if (!isScenarioCenterUiEnabled()) notFound();
  return (
    <div className="p-4 md:p-6">
      <ScenarioCenter />
    </div>
  );
}
