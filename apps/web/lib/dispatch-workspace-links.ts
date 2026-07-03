/** Canonical links into the unified dispatcher workspace (`/{jurisdiction}/dashboard`). */

export function dispatchDashboardHref(
  jurisdiction: string,
  opts?: { incidentId?: string; queue?: "all" | "non_emergency" },
): string {
  const base = `/${encodeURIComponent(jurisdiction)}/dashboard`;
  const sp = new URLSearchParams();
  if (opts?.incidentId) sp.set("incident", opts.incidentId);
  if (opts?.queue && opts.queue !== "all") sp.set("queue", opts.queue);
  const q = sp.toString();
  return q ? `${base}?${q}` : base;
}
