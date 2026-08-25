export const SCORE_TIERS = {
  actNow: 85,
  high: 70,
  medium: 55,
} as const;

/** Display/docs mirror of API source quality boosts. */
export const SOURCE_SCORE_BOOSTS = {
  officialProcurementSite: 10,
  governmentDocument: 8,
  newsArticle: 4,
  stateLegislatureBill: 15,
  e911CoordinatorReport: 18,
  femaGrantAward: 20,
  ntiaGrant: 22,
} as const;

export function scoreFontColor(score: number): string {
  if (score >= SCORE_TIERS.actNow) return "text-red-300";
  if (score >= SCORE_TIERS.high) return "text-amber-300";
  if (score >= SCORE_TIERS.medium) return "text-yellow-200";
  return "text-slate-400";
}

export function scoreBadgeClass(score: number): string {
  if (score >= SCORE_TIERS.actNow) return "border-red-500/40 bg-red-500/10 text-red-300";
  if (score >= SCORE_TIERS.high) return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  if (score >= SCORE_TIERS.medium) return "border-yellow-500/40 bg-yellow-500/10 text-yellow-200";
  return "border-slate-700 bg-slate-800 text-slate-400";
}

/** Rapid IQ intent/fit prompt colors: red ≥ 70, amber 40–69, green < 40. */
export function intentFitBadgeClass(score: number): string {
  if (score >= 70) return "border-red-500/40 bg-red-500/10 text-red-300";
  if (score >= 40) return "border-amber-500/40 bg-amber-500/10 text-amber-300";
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
}

export function fitLabel(fitScore: number): string {
  if (fitScore >= 80) return "HIGH FIT";
  if (fitScore >= 60) return "GOOD FIT";
  return "POSSIBLE FIT";
}

export function formatPopulation(pop: number): string {
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${Math.round(pop / 1_000)}K`;
  return pop.toLocaleString();
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null || value <= 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
