import { CampusCleryReviewClient } from "@/components/campus/campus-clery-review-client";
import { requireCleryPage } from "@/lib/campus/require-clery-page";
import { isRcInternalOperator } from "rapid-cortex-shared/tenancy/principal";

export default async function CleryReviewPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const { role } = await requireCleryPage(campusCode, "clery-review");
  const canReview =
    isRcInternalOperator(role) ||
    role.toUpperCase() === "CAMPUS_ADMIN" ||
    role === "agencyadmin";
  return (
    <CampusCleryReviewClient campusCode={campusCode} canReview={canReview} />
  );
}
