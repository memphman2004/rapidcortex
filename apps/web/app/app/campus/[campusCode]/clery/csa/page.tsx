import { CampusCleryCsaClient } from "@/components/campus/campus-clery-csa-client";
import { requireCleryPage } from "@/lib/campus/require-clery-page";

export default async function CleryCsaPage({ params }: { params: Promise<{ campusCode: string }> }) {
  const { campusCode } = await params;
  await requireCleryPage(campusCode, "clery-csa");
  return <CampusCleryCsaClient campusCode={campusCode} />;
}
