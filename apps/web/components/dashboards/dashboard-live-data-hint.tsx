"use client";

import { isApiConfigured } from "@/lib/api";
import {
  isOfflineDemoDataEnabled,
  isSlaBacklogEnabled,
} from "@/lib/runtime-flags";
import {
  apiNotConnectedMessage,
  featureNotAvailableMessage,
} from "@/lib/ui/feature-unavailable-copy";

type DashboardLiveDataHintProps = {
  /** When set, shows a hint specific to this feature. */
  feature?: "sla";
};

export function DashboardLiveDataHint({ feature }: DashboardLiveDataHintProps) {
  if (feature === "sla") {
    if (!isSlaBacklogEnabled()) {
      return (
        <p className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
          {featureNotAvailableMessage("Live SLA metrics")}
        </p>
      );
    }
    if (!isApiConfigured()) {
      return (
        <p className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
          {apiNotConnectedMessage(
            isOfflineDemoDataEnabled()
              ? "Sample incidents may still appear on the dispatch workspace."
              : undefined
          )}
        </p>
      );
    }
    return null;
  }

  if (isApiConfigured()) return null;

    <p className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
      Preview metrics use sample data until the platform is connected.
      {isOfflineDemoDataEnabled()
        ? " Sample incidents may still appear on the dispatch workspace."
        : null}
    </p>
  );
}
