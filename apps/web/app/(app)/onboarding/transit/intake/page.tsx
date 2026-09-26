import { notFound, redirect } from "next/navigation";
import { TransitIntakeForm } from "@/components/onboarding/transit-intake-form";
import { getAppDashboardSession } from "@/app/(app)/_lib/dashboard-session";
import {
  canAccessTransitOnboarding,
  normalizeOrgCode,
  resolveTransitIntakeAgencyId,
  resolveTransitOrgCode,
} from "@/lib/onboarding/onboarding-access";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Transit onboarding intake",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ orgCode?: string; agencyId?: string }>;
};

export default async function TransitOnboardingIntakePage({ searchParams }: Props) {
  if (!isVerticalOnboardingEnabled()) notFound();

  const session = await getAppDashboardSession();
  const params = await searchParams;
  const orgCode = resolveTransitOrgCode(session.user, params.orgCode);
  if (!orgCode) {
    redirect("/onboarding/transit/intake?orgCode=HVT");
  }

  if (!canAccessTransitOnboarding(session.user, orgCode)) {
    redirect("/unauthorized");
  }

  const agencyId = resolveTransitIntakeAgencyId(session.user, orgCode, params.agencyId);

  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Settings → Onboarding → Transit intake
      </p>
      <TransitIntakeForm orgCode={normalizeOrgCode(orgCode)} agencyId={agencyId} />
    </div>
  );
}
