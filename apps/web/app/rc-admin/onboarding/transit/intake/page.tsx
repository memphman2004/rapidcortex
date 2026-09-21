import { notFound, redirect } from "next/navigation";
import { TransitIntakeForm } from "@/components/onboarding/transit-intake-form";
import { requireRole } from "@/lib/auth/require-role";
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

const CANONICAL = "/rc-admin/onboarding/transit/intake";

export default async function RcAdminTransitIntakePage({ searchParams }: Props) {
  if (!isVerticalOnboardingEnabled()) notFound();
  const user = await requireRole(["rcsuperadmin", "rcadmin", "rcitadmin"]);
  const params = await searchParams;
  const orgCode = resolveTransitOrgCode(user, params.orgCode);
  if (!orgCode) {
    redirect(`${CANONICAL}?orgCode=HVT`);
  }
  if (!canAccessTransitOnboarding(user, orgCode)) {
    redirect("/unauthorized");
  }
  const agencyId = resolveTransitIntakeAgencyId(user, orgCode, params.agencyId);
  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Onboarding → Transit intake
      </p>
      <TransitIntakeForm orgCode={normalizeOrgCode(orgCode)} agencyId={agencyId} />
    </div>
  );
}
