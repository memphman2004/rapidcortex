import { VerticalDisclaimerBanner } from "@/components/vertical/vertical-disclaimer-banner";

const roleBadgeMap: Record<string, string> = {
  CAMPUS_ADMIN: "CAMPUS ADMIN",
  CAMPUS_SUPERVISOR: "SUPERVISOR",
  CAMPUS_SECURITY: "SECURITY",
  CAMPUS_DISPATCH: "DISPATCH",
};

export function CampusShellHeader({
  campusCode,
  role = "CAMPUS_SUPERVISOR",
}: {
  campusCode: string;
  role?: string;
}) {
  const badge = roleBadgeMap[role.trim().toUpperCase()] ?? role;

  return (
    <header className="mb-4 rounded-lg border border-slate-600/40 bg-slate-900/50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Campus Safety</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-100">{campusCode}</h1>
            <span className="rounded-full border border-slate-500/40 bg-slate-600/20 px-2.5 py-1 text-xs font-semibold text-slate-200">
              {badge}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">NOT A 911 DISPATCH CONSOLE</p>
        </div>
      </div>
      <div className="mt-3">
        <VerticalDisclaimerBanner
          tone="slate"
          message="Campus safety reporting only — escalate to your public safety agency for emergencies."
        />
      </div>
    </header>
  );
}
