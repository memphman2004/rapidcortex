import { redirect } from "next/navigation";
import { StaffGuideView } from "@/components/staff-guide/staff-guide-view";
import { loadCampusConsolePageContext } from "@/lib/campus/campus-admin-page";
import { isStaffGuideEnabled } from "@/lib/runtime-flags";

export default async function CampusStaffGuidePage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode: raw } = await params;
  const { campusCode, user } = await loadCampusConsolePageContext(raw);
  if (!isStaffGuideEnabled()) redirect(`/app/campus/${campusCode}`);

  return (
    <StaffGuideView
      vertical="campus"
      role={user.role}
      basePath={`/app/campus/${campusCode}/staff-guide`}
    />
  );
}
