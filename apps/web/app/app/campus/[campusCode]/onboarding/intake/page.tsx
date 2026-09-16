import { CampusIntakeForm } from "@/components/onboarding/campus-intake-form";
import { requireCampusOnboardingPage } from "@/lib/campus/require-campus-onboarding-page";

export default async function CampusOnboardingIntakePage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const { orgCode, agencyId } = await requireCampusOnboardingPage(campusCode);
  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Settings → Onboarding → Campus intake
      </p>
      <CampusIntakeForm orgCode={orgCode} agencyId={agencyId} />
    </div>
  );
}
