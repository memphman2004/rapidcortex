export function formatDemoClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`;
}

const UNIT_TONE: Record<string, string> = {
  available: "bg-emerald-950 text-emerald-300 ring-emerald-800",
  dispatched: "bg-sky-950 text-sky-300 ring-sky-800",
  en_route: "bg-yellow-950 text-yellow-200 ring-yellow-800",
  on_scene: "bg-orange-950 text-orange-200 ring-orange-800",
  transporting: "bg-amber-950 text-amber-200 ring-amber-800",
  cleared: "bg-slate-800 text-slate-400 ring-slate-700",
};

export function unitTone(status: string): string {
  return UNIT_TONE[status] ?? UNIT_TONE.available;
}
