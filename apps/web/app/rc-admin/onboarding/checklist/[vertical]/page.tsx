import { notFound, redirect } from "next/navigation";
import { OnboardingChecklistClient } from "@/components/onboarding/onboarding-checklist-client";
import { requireRole } from "@/lib/auth/require-role";
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

export default async function RcAdminOnboardingChecklistPage({ params, searchParams }: Props) {
  if (!isVerticalOnboardingEnabled()) notFound();
  const user = await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  const { vertical: verticalParam } = await params;
  const vertical = parseVertical(verticalParam);
  if (!vertical) notFound();

  const sp = await searchParams;
  const orgCode =
    vertical === "campus"
      ? resolveCampusOrgCode(user, sp.orgCode)
      : resolveVenueOrgCode(user, sp.orgCode);

  if (!orgCode) {
    redirect(
      `/rc-admin/onboarding/checklist/${vertical}?orgCode=${vertical === "campus" ? "UGA" : "MBS"}`,
    );
  }

  const allowed =
    vertical === "campus"
      ? canAccessCampusOnboarding(user, orgCode)
      : canAccessVenueOnboarding(user, orgCode);
  if (!allowed) redirect("/unauthorized");

  const agencyId = sp.agencyId?.trim() || user.agencyId;
  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Onboarding → Checklist
      </p>
      <OnboardingChecklistClient
        vertical={vertical}
        orgCode={normalizeOrgCode(orgCode)}
        agencyId={agencyId}
      />
    </div>
  );
}
