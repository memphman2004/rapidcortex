import type { ActivityItem } from "@/lib/dashboards/mockDashboardData";
import { StatusBadge } from "./status-badge";

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="rounded-lg border border-slate-700/80 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-white">Activity</h2>
      <ul className="mt-4 space-y-4">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 border-b border-slate-800 pb-4 last:border-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-100">{item.title}</p>
                {item.tone ? <StatusBadge tone={item.tone} /> : null}
              </div>
              <p className="mt-1 text-xs text-slate-400">{item.description}</p>
            </div>
            <span className="shrink-0 text-xs text-slate-500">{item.timeLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
