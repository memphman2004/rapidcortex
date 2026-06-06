"use client";

import type { AuditEvent } from "rapid-cortex-shared";

export function GlobalAuditTable({ items }: { items: AuditEvent[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No events match the current filters.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full text-left text-xs text-slate-300">
        <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-2 py-2">Time</th>
            <th className="px-2 py-2">Agency</th>
            <th className="px-2 py-2">Type</th>
            <th className="px-2 py-2">Actor</th>
            <th className="px-2 py-2">Resource</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <tr key={e.eventId} className="border-b border-slate-800/80 hover:bg-slate-900/30">
              <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px] text-slate-500">
                {e.createdAt}
              </td>
              <td className="px-2 py-1.5 font-mono text-[10px] text-slate-400">{e.agencyId}</td>
              <td className="px-2 py-1.5 text-slate-200">{e.type}</td>
              <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500">{e.actorId ?? "—"}</td>
              <td className="px-2 py-1.5 text-slate-500">
                {e.resourceType ?? "—"} {e.resourceId ? `· ${e.resourceId}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
