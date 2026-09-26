import type { LoadoutKeyRecord } from "rapid-cortex-shared/loadout";
import { KeysClient } from "./keys-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Loadout API Keys",
  robots: { index: false, follow: false },
};

async function fetchKeys(): Promise<{ keys: LoadoutKeyRecord[]; tenantId: string }> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/loadout/features`,
      { cache: "no-store" },
    );
    if (!res.ok) return { keys: [], tenantId: "" };
    const data = await res.json();
    return {
      keys: data.keys ?? [],
      tenantId: data.subscription?.tenantId ?? "",
    };
  } catch {
    return { keys: [], tenantId: "" };
  }
}

export default async function LoadoutKeysPage() {
  const { keys, tenantId } = await fetchKeys();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">API Keys</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage NexCortiQ Loadout API keys. Keys are shown once at provisioning — store them securely.
        </p>
      </div>
      <div className="rounded-md border border-amber-800/60 bg-amber-950/30 px-4 py-3 text-xs text-amber-300">
        ⚠️ API keys grant access to all enabled Loadout features. Never commit keys to source control.
        Use AWS Secrets Manager or equivalent. Keys are prefixed <code className="font-mono">ncq_live_</code>.
      </div>
      <KeysClient keys={keys} tenantId={tenantId} />
    </div>
  );
}
