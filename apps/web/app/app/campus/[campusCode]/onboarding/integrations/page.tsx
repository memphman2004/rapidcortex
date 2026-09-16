import { CampusIntegrationForm } from "@/components/onboarding/campus-integration-form";
import { requireCampusOnboardingPage } from "@/lib/campus/require-campus-onboarding-page";

export default async function CampusOnboardingIntegrationsPage({
  params,
}: {
  params: Promise<{ campusCode: string }>;
}) {
  const { campusCode } = await params;
  const { orgCode, agencyId } = await requireCampusOnboardingPage(campusCode);
  return (
    <div>
      <p className="mb-6 text-xs uppercase tracking-wider text-slate-500">
        Settings → Onboarding → Integration questionnaire
      </p>
      <CampusIntegrationForm orgCode={orgCode} agencyId={agencyId} />
    </div>
  );
}
