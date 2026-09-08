import { CampusCleryDclClient } from "@/components/campus/campus-clery-dcl-client";
import { requireCleryPage } from "@/lib/campus/require-clery-page";

export default async function CleryDclPage({ params }: { params: Promise<{ campusCode: string }> }) {
  const { campusCode } = await params;
  await requireCleryPage(campusCode, "clery-dcl");
  return <CampusCleryDclClient campusCode={campusCode} />;
}
