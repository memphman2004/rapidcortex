import { redirect } from "next/navigation";
import { isRcStaff } from "rapid-cortex-security";
import { ModelTrainingStudio } from "@/components/rc-admin/model-training-studio";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { marketingLoginPath } from "@/lib/marketing-links";

export const metadata = {
  title: "Model Training Studio",
  robots: { index: false, follow: false },
};

export default async function ModelTrainingStudioPage() {
  const user = await getDashboardSessionUser();
  if (!user || !isRcStaff(user.role)) {
    redirect(`${marketingLoginPath()}?from=/rc-admin/vision/model-studio`);
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-300">iQ Vision</p>
        <h1 className="text-2xl font-semibold text-white">Model Training Studio</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          RC Admin, RC IT, and RC Superadmin manage datasets and model approval here. Live threat review stays in the dispatcher iQ Vision Command Center.
        </p>
      </div>
      <ModelTrainingStudio />
    </div>
  );
}
