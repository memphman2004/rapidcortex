"use client";

import { formatUserRoleLabel } from "@/lib/auth/roles";
import type { AdminUserRow } from "@/lib/api";
import type { UserRole } from "rapid-cortex-shared/types";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

const roleColor: Record<string, string> = {
  rcsuperadmin: "text-rose-200 ring-rose-500/30",
  rcadmin: "text-fuchsia-200 ring-fuchsia-500/25",
  rcitadmin: "text-violet-200 ring-violet-500/25",
  agencyadmin: "text-sky-200 ring-sky-500/25",
  supervisor: "text-amber-200 ring-amber-500/20",
  dispatcher: "text-slate-200 ring-slate-600",
};

export function CrossTenantUserTable({
  users,
  search,
  renderActions,
}: {
  users: AdminUserRow[];
  search: string;
  renderActions?: (u: AdminUserRow) => ReactNode;
}) {
  const q = search.trim().toLowerCase();
  const rows = !q
    ? users
    : users.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.agencyId.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q),
      );

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No users match this search.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="min-w-full text-left text-xs">
        <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-2 py-2">User</th>
            <th className="px-2 py-2">Agency</th>
            <th className="px-2 py-2">Role</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Flags</th>
            {renderActions ? <th className="px-2 py-2">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => {
            const missing = !u.agencyId || !u.role;
            return (
              <tr key={u.username} className="border-b border-slate-800/80">
                <td className="px-2 py-1.5">
                  <div className="text-sm font-medium text-slate-100">{u.email}</div>
                  <div className="font-mono text-[10px] text-slate-500">{u.username}</div>
                </td>
                <td className="px-2 py-1.5 font-mono text-[10px] text-slate-300">{u.agencyId || "—"}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${roleColor[u.role] ?? "text-slate-200 ring-slate-600"}`}
                  >
                    {formatUserRoleLabel(u.role as UserRole)}
                  </span>
                </td>
                <td className="px-2 py-1.5 text-slate-400">
                  {u.status} · {u.enabled ? "enabled" : "disabled"}
                </td>
                <td className="px-2 py-1.5">
                  {missing ? (
                    <span className="inline-flex items-center gap-1 text-amber-200/90" title="Missing role or agency">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span className="text-[10px]">Fix attrs</span>
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                {renderActions ? (
                  <td className="px-2 py-1.5 whitespace-nowrap">{renderActions(u)}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
