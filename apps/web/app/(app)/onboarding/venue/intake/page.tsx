import { notFound, redirect } from "next/navigation";
import { VenueIntakeForm } from "@/components/onboarding/venue-intake-form";
import { getAppDashboardSession } from "@/app/(app)/_lib/dashboard-session";
import {
  canAccessVenueOnboarding,
  normalizeOrgCode,
  resolveVenueOrgCode,
} from "@/lib/onboarding/onboarding-access";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";

export const metadata = {
  title: "Venue onboarding intake",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ orgCode?: string; agencyId?: string }>;
};

export default async function VenueOnboardingIntakePage({ searchParams }: Props) {
  if (!isVerticalOnboardingEnabled()) notFound();

  const session = await getAppDashboardSession();
  const params = await searchParams;
  const orgCode = resolveVenueOrgCode(session.user, params.orgCode);
  if (!orgCode) {
    redirect("/onboarding/venue/intake?orgCode=MBS");
  }

  if (!canAccessVenueOnboarding(session.user, orgCode)) {
    redirect("/unauthorized");
  }

  const agencyId = params.agencyId?.trim() || session.user.agencyId;

  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Settings → Onboarding → Venue intake
      </p>
      <VenueIntakeForm orgCode={normalizeOrgCode(orgCode)} agencyId={agencyId} />
    </div>
  );
}
