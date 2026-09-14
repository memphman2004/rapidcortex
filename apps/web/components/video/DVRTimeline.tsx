"use client";

function toDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function DVRTimeline({
  startMs,
  endMs,
  onChange,
}: {
  startMs: number;
  endMs: number;
  onChange: (startMs: number, endMs: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[10px] uppercase" style={{ color: "#8b7bb5" }}>
        Start
        <input
          type="datetime-local"
          className="rounded px-2 py-1 text-[12px]"
          style={{ background: "#1a1528", color: "#e9d5ff", border: "1px solid #2e1065" }}
          value={toDatetimeLocal(startMs)}
          onChange={(e) => {
            const next = new Date(e.target.value).getTime();
            if (Number.isFinite(next)) onChange(next, endMs);
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase" style={{ color: "#8b7bb5" }}>
        End
        <input
          type="datetime-local"
          className="rounded px-2 py-1 text-[12px]"
          style={{ background: "#1a1528", color: "#e9d5ff", border: "1px solid #2e1065" }}
          value={toDatetimeLocal(endMs)}
          onChange={(e) => {
            const next = new Date(e.target.value).getTime();
            if (Number.isFinite(next)) onChange(startMs, next);
          }}
        />
      </label>
    </div>
  );
}
