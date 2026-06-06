"use client";

export type UniqueDetailCategory = "hazard" | "injury" | "description" | "access" | "other";

export type UniqueDetailRow = {
  callId: string;
  detail: string;
  category: UniqueDetailCategory;
  caller: string;
  timestamp: string;
};

const CATEGORY: Record<
  UniqueDetailCategory,
  { icon: string; label: string; accent: string; panel: string }
> = {
  hazard: {
    icon: "⚠️",
    label: "Hazard",
    accent: "text-rose-300",
    panel: "border-rose-500/30 bg-rose-500/10",
  },
  injury: {
    icon: "🩹",
    label: "Injury",
    accent: "text-orange-300",
    panel: "border-orange-500/30 bg-orange-500/10",
  },
  access: {
    icon: "🚧",
    label: "Access",
    accent: "text-amber-300",
    panel: "border-amber-500/30 bg-amber-500/10",
  },
  description: {
    icon: "📝",
    label: "Description",
    accent: "text-sky-300",
    panel: "border-sky-500/30 bg-sky-500/10",
  },
  other: {
    icon: "ℹ️",
    label: "Other",
    accent: "text-slate-300",
    panel: "border-slate-600/40 bg-slate-800/40",
  },
};

export function SurgeUniqueDetailsPanel({ details }: { details: UniqueDetailRow[] }) {
  const grouped = details.reduce(
    (acc, d) => {
      acc[d.category].push(d);
      return acc;
    },
    {
      hazard: [] as UniqueDetailRow[],
      injury: [] as UniqueDetailRow[],
      description: [] as UniqueDetailRow[],
      access: [] as UniqueDetailRow[],
      other: [] as UniqueDetailRow[],
    },
  );

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Unique details ({details.length})
      </h3>
      <p className="mb-3 text-[11px] text-slate-500">
        Information one caller mentioned that others did not emphasize.
      </p>
      <div className="space-y-4">
        {(Object.keys(grouped) as UniqueDetailCategory[]).map((cat) => {
          const rows = grouped[cat];
          if (rows.length === 0) return null;
          const meta = CATEGORY[cat];
          return (
            <div key={cat}>
              <div className={`mb-2 flex items-center gap-2 text-xs font-semibold ${meta.accent}`}>
                <span>{meta.icon}</span>
                <span>{meta.label}</span>
                <span className="font-normal text-slate-600">({rows.length})</span>
              </div>
              <ul className="space-y-2">
                {rows.map((row, idx) => (
                  <li
                    key={`${row.callId}-${idx}`}
                    className={`rounded-md border px-3 py-2 ${meta.panel}`}
                  >
                    <p className="text-xs leading-relaxed text-slate-100">{row.detail}</p>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Caller {row.caller} · {new Date(row.timestamp).toLocaleTimeString()}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
