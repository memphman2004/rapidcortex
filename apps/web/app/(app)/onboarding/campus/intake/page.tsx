import { notFound, redirect } from "next/navigation";
import { CampusIntakeForm } from "@/components/onboarding/campus-intake-form";
import { getAppDashboardSession } from "@/app/(app)/_lib/dashboard-session";
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

export default async function CampusOnboardingIntakePage({ searchParams }: Props) {
  if (!isVerticalOnboardingEnabled()) notFound();

  const session = await getAppDashboardSession();
  const params = await searchParams;
  const orgCode = resolveCampusOrgCode(session.user, params.orgCode);
  if (!orgCode) {
    redirect("/onboarding/campus/intake?orgCode=UGA");
  }

  if (!canAccessCampusOnboarding(session.user, orgCode)) {
    redirect("/unauthorized");
  }

  const agencyId = params.agencyId?.trim() || session.user.agencyId;

  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Settings → Onboarding → Campus intake
      </p>
      <CampusIntakeForm orgCode={normalizeOrgCode(orgCode)} agencyId={agencyId} />
    </div>
  );
}
