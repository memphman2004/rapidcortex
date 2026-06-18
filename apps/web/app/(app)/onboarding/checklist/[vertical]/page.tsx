import { notFound, redirect } from "next/navigation";
import { OnboardingChecklistClient } from "@/components/onboarding/onboarding-checklist-client";
import { getAppDashboardSession } from "@/app/(app)/_lib/dashboard-session";
import {
  canAccessCampusOnboarding,
  canAccessVenueOnboarding,
  normalizeOrgCode,
  resolveCampusOrgCode,
  resolveVenueOrgCode,
} from "@/lib/onboarding/onboarding-access";
import { isVerticalOnboardingEnabled } from "@/lib/runtime-flags";
import type { OnboardingVertical } from "rapid-cortex-shared";

export const metadata = {
  title: "Onboarding checklist",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ vertical: string }>;
  searchParams: Promise<{ orgCode?: string; agencyId?: string }>;
};

function parseVertical(raw: string): OnboardingVertical | null {
  const v = raw.trim().toLowerCase();
  if (v === "campus" || v === "venue") return v;
  return null;
}

export default async function OnboardingChecklistPage({ params, searchParams }: Props) {
  if (!isVerticalOnboardingEnabled()) notFound();

  const { vertical: verticalParam } = await params;
  const vertical = parseVertical(verticalParam);
  if (!vertical) notFound();

  const session = await getAppDashboardSession();
  const sp = await searchParams;
  const orgCode =
    vertical === "campus"
      ? resolveCampusOrgCode(session.user, sp.orgCode)
      : resolveVenueOrgCode(session.user, sp.orgCode);

  if (!orgCode) {
    redirect(
      `/onboarding/checklist/${vertical}?orgCode=${vertical === "campus" ? "UGA" : "MBS"}`,
    );
  }

  const allowed =
    vertical === "campus"
      ? canAccessCampusOnboarding(session.user, orgCode)
      : canAccessVenueOnboarding(session.user, orgCode);
  if (!allowed) redirect("/unauthorized");

  const agencyId = sp.agencyId?.trim() || session.user.agencyId;

  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Settings → Onboarding → Checklist
      </p>
      <OnboardingChecklistClient
        vertical={vertical}
        orgCode={normalizeOrgCode(orgCode)}
        agencyId={agencyId}
      />
    </div>
  );
}
