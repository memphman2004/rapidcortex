import { CampusCleryAsrClient } from "@/components/campus/campus-clery-asr-client";
import { requireCleryPage } from "@/lib/campus/require-clery-page";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";

export default async function CleryAsrPage({ params }: { params: Promise<{ campusCode: string }> }) {
  const { campusCode } = await params;
  const { role } = await requireCleryPage(campusCode, "clery-asr");
  const canGenerate =
    isRcInternalOperator(role) || role.toUpperCase() === "CAMPUS_ADMIN" || role === "agencyadmin";
  return <CampusCleryAsrClient campusCode={campusCode} canGenerate={canGenerate} />;
}
