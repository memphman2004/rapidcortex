import { CatalogClient } from "./catalog-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Loadout Catalog",
  robots: { index: false, follow: false },
};

async function fetchActive(): Promise<{ activeFeatures: string[]; tenantId: string }> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/loadout/features`,
      { cache: "no-store" },
    );
    if (!res.ok) return { activeFeatures: [], tenantId: "" };
    const data = await res.json();
    return {
      activeFeatures: data.subscription?.activeFeatures ?? [],
      tenantId: data.subscription?.tenantId ?? "",
    };
  } catch {
    return { activeFeatures: [], tenantId: "" };
  }
}

export default async function LoadoutCatalogPage() {
  const { activeFeatures, tenantId } = await fetchActive();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Feature Catalog</h1>
        <p className="mt-1 text-sm text-slate-400">
          Browse and activate NexCortiQ Loadout API features.
        </p>
      </div>
      <CatalogClient activeFeatures={activeFeatures} tenantId={tenantId} />
    </div>
  );
}
