import { CampusCleryZonesClient } from "@/components/campus/campus-clery-zones-client";
import { requireCleryPage } from "@/lib/campus/require-clery-page";

export default async function CleryZonesPage({ params }: { params: Promise<{ campusCode: string }> }) {
  const { campusCode } = await params;
  await requireCleryPage(campusCode, "clery-zones");
  return <CampusCleryZonesClient campusCode={campusCode} />;
}
