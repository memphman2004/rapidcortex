"use client";

import type { LoadoutSubscription } from "rapid-cortex-shared/loadout";

interface LoadoutConsoleStripProps {
  subscription: LoadoutSubscription | null;
}

const TIER_COLORS: Record<string, string> = {
  small: "bg-slate-700 text-slate-200",
  medium: "bg-sky-900 text-sky-200",
  large: "bg-violet-900 text-violet-200",
  enterprise: "bg-amber-900 text-amber-200",
};

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-400",
  suspended: "text-yellow-400",
  cancelled: "text-red-400",
};

export function LoadoutConsoleStrip({ subscription }: LoadoutConsoleStripProps) {
  if (!subscription) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">No active Loadout subscription found.</span>
        <a
          href="mailto:sales@rapidcortex.us"
          className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
        >
          Contact Sales →
        </a>
      </div>
    );
  }

  const tierColor = TIER_COLORS[subscription.tier] ?? TIER_COLORS.small;
  const statusColor = STATUS_COLORS[subscription.status] ?? "text-slate-400";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Organization</p>
        <p className="text-sm text-white font-medium truncate">{subscription.orgName}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tier</p>
        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${tierColor}`}>
          {subscription.tier.toUpperCase()}
        </span>
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Status</p>
        <p className={`text-sm font-medium ${statusColor}`}>{subscription.status}</p>
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Active Features</p>
        <p className="text-sm text-white font-medium">{subscription.activeFeatures.length}</p>
      </div>
    </div>
  );
}
