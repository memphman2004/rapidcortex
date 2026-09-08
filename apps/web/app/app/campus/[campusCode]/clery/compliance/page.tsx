import { CampusCleryComplianceClient } from "@/components/campus/campus-clery-compliance-client";
import { requireCleryPage } from "@/lib/campus/require-clery-page";

export default async function CleryCompliancePage({ params }: { params: Promise<{ campusCode: string }> }) {
  const { campusCode } = await params;
  await requireCleryPage(campusCode, "clery-compliance");
  return <CampusCleryComplianceClient campusCode={campusCode} />;
}
