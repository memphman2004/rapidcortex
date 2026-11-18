import { redirect } from "next/navigation";
import { DemoCenter } from "@/src/demo/ui/DemoCenter";
import { demoNeutralPathForReason } from "@/src/demo/tokens/demo-link-paths";
import { verifyDemoToken } from "@/src/demo/tokens/demo-token";
import { isDemoTokenRevoked } from "@/src/demo/tokens/token-store";
import { getScenario } from "@/src/demo/scenarios/registry";

export const dynamic = "force-dynamic";

export default async function DemoSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const decoded = decodeURIComponent(token);
  const secret = process.env.DEMO_TOKEN_SIGNING_SECRET?.trim() ?? "";
  const verdict = await verifyDemoToken(decoded, secret, { isRevoked: isDemoTokenRevoked });
  if (!verdict.ok) redirect(demoNeutralPathForReason(verdict.reason));
  if (!getScenario(verdict.claims.scenarioId)) redirect("/demo-link/invalid");

  return (
    <DemoCenter
      shareToken={decoded}
      autostart={{
        scenarioId: verdict.claims.scenarioId,
        offsetSeconds: verdict.claims.offsetSeconds,
        tourStop: verdict.claims.tourStop || undefined,
      }}
    />
  );
}
