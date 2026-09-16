import { OnboardingChecklistClient } from "@/components/onboarding/onboarding-checklist-client";
import { requireCampusOnboardingPage } from "@/lib/campus/require-campus-onboarding-page";

export default async function CampusOnboardingChecklistPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const { orgCode, agencyId } = await requireCampusOnboardingPage(campusCode);
  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Settings → Onboarding → Checklist
      </p>
      <OnboardingChecklistClient vertical="campus" orgCode={orgCode} agencyId={agencyId} />
    </div>
  );
}
