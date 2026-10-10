import { isCampusAdminRole } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { CampusCleryAsrClient } from "@/components/campus/campus-clery-asr-client";
import { requireCleryPage } from "@/lib/campus/require-clery-page";

export default async function CleryAsrPage({ params }: { params: Promise<{ campusCode: string }> }) {
  const { campusCode } = await params;
  const { role } = await requireCleryPage(campusCode, "clery-asr");
  const canGenerate =
    isRcInternalOperator(role) || isCampusAdminRole(role) || role === "agencyadmin";
  return <CampusCleryAsrClient campusCode={campusCode} canGenerate={canGenerate} />;
}
