export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-slate-700/80 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-4 shadow-sm ring-1 ring-white/[0.03]"
      style={{ borderTop: "3px solid var(--role-accent, #0ea5e9)" }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--role-text-accent, rgb(226 232 240))" }}
      >
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-300">{hint}</p> : null}
    </div>
  );
}
