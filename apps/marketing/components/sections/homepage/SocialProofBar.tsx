import { Building2, CalendarCheck2, Layers, ShieldCheck } from "lucide-react";

const PROOF_ITEMS = [
  {
    icon: Building2,
    label: "Deployed across public safety agencies",
  },
  {
    icon: Layers,
    label: "911, Campus, Venue & Transit verticals",
  },
  {
    icon: CalendarCheck2,
    label: "60-day structured pilot",
  },
  {
    icon: ShieldCheck,
    label: "CJIS-aware architecture",
  },
] as const;

export function SocialProofBar() {
  return (
    <section
      aria-label="Platform proof points"
      className="border-y border-slate-800/80 bg-slate-950/90"
    >
      <ul className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 text-center sm:px-6 sm:py-5">
        {PROOF_ITEMS.map((item) => (
          <li
            key={item.label}
            className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-300"
          >
            <item.icon className="h-4 w-4 shrink-0 text-sky-400/90" aria-hidden />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
