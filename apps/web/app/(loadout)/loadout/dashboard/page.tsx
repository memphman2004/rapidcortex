import type { LoadoutSubscription, LoadoutUsageRecord, LoadoutInvoice } from "rapid-cortex-shared/loadout";
import { LoadoutConsoleStrip } from "../_components/LoadoutConsoleStrip";
import { FeatureUsageCard } from "../_components/FeatureUsageCard";
import { InvoicePreviewPanel } from "../_components/InvoicePreviewPanel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Loadout Dashboard",
  robots: { index: false, follow: false },
};

async function fetchSubscription(): Promise<LoadoutSubscription | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/loadout/features`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.subscription ?? null;
  } catch {
    return null;
  }
}

async function fetchInvoicePreview(): Promise<LoadoutInvoice | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/loadout/invoice/preview`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.invoice ?? null;
  } catch {
    return null;
  }
}

export default async function LoadoutDashboardPage() {
  const [subscription, invoice] = await Promise.all([
    fetchSubscription(),
    fetchInvoicePreview(),
  ]);

  // Build stub usage cards from active features if subscription exists
  const usageItems: LoadoutUsageRecord[] = subscription?.activeFeatures.map((fid) => ({
    tenantId: subscription.tenantId,
    featureId: fid,
    period: new Date().toISOString().slice(0, 7),
    callCount: 0,
    quotaLimit: 10_000,
    ttl: 0,
  })) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Loadout Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          API key management, usage metering, and billing for NexCortiQ Loadout.
        </p>
      </div>

      <LoadoutConsoleStrip subscription={subscription} />

      {usageItems.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
            Current Period Usage
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {usageItems.map((item) => (
              <FeatureUsageCard
                key={item.featureId}
                featureId={item.featureId}
                featureName={item.featureId.replace(/_/g, " ")}
                callCount={item.callCount}
                quotaLimit={item.quotaLimit}
                period={item.period}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">
          Current Invoice Preview
        </h2>
        <InvoicePreviewPanel invoice={invoice} />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { href: "/loadout/catalog", label: "Browse Catalog", desc: "Add or remove API features", icon: "📦" },
          { href: "/loadout/invoices", label: "View Invoices", desc: "Download billing history", icon: "🧾" },
          { href: "/loadout/keys", label: "Manage API Keys", desc: "Provision and revoke keys", icon: "🔑" },
        ].map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="rounded-lg border border-slate-700 bg-slate-900/50 p-5 hover:border-violet-600 hover:bg-violet-950/20 transition-colors group"
          >
            <div className="text-2xl mb-2">{card.icon}</div>
            <h3 className="text-sm font-semibold text-white group-hover:text-violet-300 transition-colors">
              {card.label}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{card.desc}</p>
          </a>
        ))}
      </section>
    </div>
  );
}
