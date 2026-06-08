export function VerticalDisclaimerBanner({
  message,
  tone = "amber",
}: {
  message: string;
  tone?: "amber" | "slate";
}) {
  const styles =
    tone === "slate"
      ? "border-slate-600/40 bg-slate-900/50 text-slate-300"
      : "border-amber-500/35 bg-amber-950/25 text-amber-100";

  return (
    <div
      role="note"
      className={`rounded-md border px-3 py-2 text-xs font-medium tracking-wide ${styles}`}
    >
      {message}
    </div>
  );
}
