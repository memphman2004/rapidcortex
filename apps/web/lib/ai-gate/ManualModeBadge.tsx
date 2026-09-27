/**
 * Non-obtrusive amber indicator when an AI feature is in manual mode.
 */
export function ManualModeBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-2.5 py-1.5 text-xs font-medium text-amber-200/80">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
      {label} — Manual Mode
    </div>
  );
}
