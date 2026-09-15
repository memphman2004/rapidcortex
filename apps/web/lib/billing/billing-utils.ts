export function formatCentsUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function formatBillingPeriodLabel(period: string): string {
  const [year, month] = period.split("-");
  if (!year || !month) return period;
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
}

export function formatIsoDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

export function invoiceStatusClass(status: string): string {
  switch (status) {
    case "draft":
      return "bg-slate-700 text-slate-100";
    case "sent":
      return "bg-sky-700 text-sky-50";
    case "paid":
      return "bg-emerald-700 text-emerald-50";
    case "overdue":
      return "bg-red-700 text-red-50 animate-pulse";
    case "voided":
      return "bg-slate-600 text-slate-300";
    case "disputed":
      return "bg-amber-700 text-amber-50";
    default:
      return "bg-slate-700 text-slate-100";
  }
}
