import { notFound, redirect } from "next/navigation";
import { CampusIntegrationForm } from "@/components/onboarding/campus-integration-form";
import { getAppDashboardSession } from "@/app/(app)/_lib/dashboard-session";
import {
  canAccessCampusOnboarding,
  normalizeOrgCode,
  resolveCampusOrgCode,
} from "@/lib/onboarding/onboarding-access";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Campus integration questionnaire",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ orgCode?: string; agencyId?: string }>;
};

export default async function CampusIntegrationQuestionnairePage({ searchParams }: Props) {
  if (!isVerticalOnboardingEnabled()) notFound();

  const session = await getAppDashboardSession();
  const params = await searchParams;
  const orgCode = resolveCampusOrgCode(session.user, params.orgCode);
  if (!orgCode) {
    redirect("/onboarding/campus/integrations?orgCode=UGA");
  }

  if (!canAccessCampusOnboarding(session.user, orgCode)) {
    redirect("/unauthorized");
  }

  const agencyId = params.agencyId?.trim() || session.user.agencyId;

  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Settings → Onboarding → Integration questionnaire
      </p>
      <CampusIntegrationForm orgCode={normalizeOrgCode(orgCode)} agencyId={agencyId} />
    </div>
  );
}
