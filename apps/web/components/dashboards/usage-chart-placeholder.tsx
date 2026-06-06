export function UsageChartPlaceholder({ title }: { title?: string }) {
  return (
    <div className="flex h-48 flex-col justify-center rounded-lg border border-slate-700/80 bg-slate-950/60 p-4">
      <p className="text-sm font-medium text-white">{title ?? "Usage trend"}</p>
      <p className="mt-2 text-xs text-slate-500">
        {/* TODO: Wire to time-series API (agencyId required for non–rcsuperadmin). */}
        Chart placeholder — connect CloudWatch or analytics warehouse.
      </p>
      <div className="mt-4 flex flex-1 items-end gap-1">
        {[40, 65, 45, 80, 55, 70, 50, 85, 60, 75, 48, 90].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-blue-900/40 to-sky-500/30"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
