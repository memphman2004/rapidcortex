import { notFound, redirect } from "next/navigation";
import { VenueIntakeForm } from "@/components/onboarding/venue-intake-form";
import { requireRole } from "@/lib/auth/require-role";
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

const CANONICAL = "/rc-admin/onboarding/venue/intake";

export default async function RcAdminVenueIntakePage({ searchParams }: Props) {
  if (!isVerticalOnboardingEnabled()) notFound();
  const user = await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  const params = await searchParams;
  const orgCode = resolveVenueOrgCode(user, params.orgCode);
  if (!orgCode) {
    redirect(`${CANONICAL}?orgCode=MBS`);
  }
  if (!canAccessVenueOnboarding(user, orgCode)) {
    redirect("/unauthorized");
  }
  const agencyId = params.agencyId?.trim() || user.agencyId;
  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Onboarding → Venue intake
      </p>
      <VenueIntakeForm orgCode={normalizeOrgCode(orgCode)} agencyId={agencyId} />
    </div>
  );
}
