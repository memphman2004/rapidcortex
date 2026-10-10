import { isCampusAdminRole } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";
import { CampusCleryReviewClient } from "@/components/campus/campus-clery-review-client";
import { requireCleryPage } from "@/lib/campus/require-clery-page";

export default async function CleryReviewPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const { role } = await requireCleryPage(campusCode, "clery-review");
  const canReview =
    isRcInternalOperator(role) || isCampusAdminRole(role) || role === "agencyadmin";
  return (
    <CampusCleryReviewClient campusCode={campusCode} canReview={canReview} />
  );
}
