"use client";

interface FeatureUsageCardProps {
  featureId: string;
  featureName: string;
  callCount: number;
  quotaLimit: number;
  period: string;
}

export function FeatureUsageCard({
  featureName,
  callCount,
  quotaLimit,
  period,
}: FeatureUsageCardProps) {
  const pct = quotaLimit > 0 ? Math.min(100, Math.round((callCount / quotaLimit) * 100)) : 0;
  const barColor =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-white">{featureName}</h3>
        <span className="text-xs text-slate-500">{period}</span>
      </div>
      <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{callCount.toLocaleString()} calls</span>
        <span>{pct}% of {quotaLimit.toLocaleString()}</span>
      </div>
    </div>
  );
}
