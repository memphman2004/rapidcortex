import { notFound, redirect } from "next/navigation";
import { CampusIntakeForm } from "@/components/onboarding/campus-intake-form";
import { requireRole } from "@/lib/auth/require-role";
import {
  canAccessCampusOnboarding,
  normalizeOrgCode,
  resolveCampusOrgCode,
} from "@/lib/onboarding/onboarding-access";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Campus onboarding intake",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ orgCode?: string; agencyId?: string }>;
};

const CANONICAL = "/rc-admin/onboarding/campus/intake";

export default async function RcAdminCampusIntakePage({ searchParams }: Props) {
  if (!isVerticalOnboardingEnabled()) notFound();
  const user = await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  const params = await searchParams;
  const orgCode = resolveCampusOrgCode(user, params.orgCode);
  if (!orgCode) {
    redirect(`${CANONICAL}?orgCode=UGA`);
  }
  if (!canAccessCampusOnboarding(user, orgCode)) {
    redirect("/unauthorized");
  }
  const agencyId = params.agencyId?.trim() || user.agencyId;
  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Onboarding → Campus intake
      </p>
      <CampusIntakeForm orgCode={normalizeOrgCode(orgCode)} agencyId={agencyId} />
    </div>
  );
}
