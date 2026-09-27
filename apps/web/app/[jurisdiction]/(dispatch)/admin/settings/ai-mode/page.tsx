import Link from "next/link";
import { redirect } from "next/navigation";
import { AIFeatureGateControl } from "@/components/admin/AIFeatureGateControl";
import { AIGateAuditLog } from "@/components/admin/AIGateAuditLog";
import { AIGateProvider } from "@/lib/ai-gate";
import { getDashboardSessionUser } from "@/lib/dashboards/get-dashboard-session";
import { isAiFeatureGateEnabled } from "@/lib/runtime-flags";
import { canToggleAIGate } from "rapid-cortex-security";
import type { AIGateConfig } from "rapid-cortex-shared";
import { defaultAIGateConfig } from "rapid-cortex-shared";

type Props = { params: Promise<{ jurisdiction: string }> };

async function fetchInitialConfig(agencyId: string): Promise<AIGateConfig> {
  // Server components cannot easily attach Cognito cookies to upstream without BFF;
  // default-on until client hydrates. Toggle path still authoritative on API.
  return defaultAIGateConfig(agencyId);
}

export default async function AiModeSettingsPage({ params }: Props) {
  const { jurisdiction } = await params;
  if (!isAiFeatureGateEnabled()) {
    redirect(`/${jurisdiction}/admin/settings`);
  }

  const user = await getDashboardSessionUser();
  if (!user?.agencyId) {
    redirect(`/${jurisdiction}/admin/settings`);
  }

  const agencyId = user.agencyId;
  const canToggle = canToggleAIGate(
    {
      userId: user.userId,
      agencyId: user.agencyId,
      role: user.role,
      email: user.email,
    },
    agencyId,
  );
  const initial = await fetchInitialConfig(agencyId);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <p className="text-xs text-slate-500">
          <Link href={`/${jurisdiction}/admin/settings`} className="text-sky-400 hover:underline">
            ← Admin settings
          </Link>
        </p>
        <h1 className="mt-2 text-lg font-semibold text-white">AI mode</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Control agency-wide AI features. Changes broadcast live to connected consoles.
        </p>
      </div>

      <AIGateProvider agencyId={agencyId} initial={initial}>
        <AIFeatureGateControl agencyId={agencyId} canToggle={canToggle} />
        {canToggle && <AIGateAuditLog agencyId={agencyId} />}
      </AIGateProvider>
    </div>
  );
}
