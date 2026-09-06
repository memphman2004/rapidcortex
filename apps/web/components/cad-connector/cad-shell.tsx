"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { UserContext } from "rapid-cortex-shared/types";
import {
  canManageCadConnectors,
  canManageCadRouting,
  canViewCadAudit,
} from "@/lib/cad-connector/cad-authz";
import { fetchCadStatus, type CadStatusItem } from "@/lib/cad-connector/cad-connector-api";

function dotClass(status?: string): string {
  if (status === "healthy") return "bg-emerald-400";
  if (status === "degraded" || status === "auth_failure") return "bg-amber-400";
  if (status === "unreachable") return "bg-red-500";
  return "bg-slate-500";
}

export function CadShell({
  user,
  jurisdiction,
  children,
}: {
  user: UserContext;
  jurisdiction: string;
  children: React.ReactNode;
}) {
  const base = `/${jurisdiction}/cad`;
  const [status, setStatus] = useState<CadStatusItem[]>([]);
  useEffect(() => {
    void fetchCadStatus()
      .then(setStatus)
      .catch(() => setStatus([]));
  }, []);

  const tabs = [
    { href: `${base}/incidents`, label: "Incidents", show: true },
    { href: `${base}/write-back`, label: "Write-Back", show: true },
    { href: `${base}/connectors`, label: "Connectors", show: canManageCadConnectors(user, user.agencyId) },
    { href: `${base}/routing`, label: "Routing", show: canManageCadRouting(user, user.agencyId) },
    { href: `${base}/audit`, label: "Audit", show: canViewCadAudit(user, user.agencyId) },
  ].filter((t) => t.show);

  return (
    <div className="min-h-screen bg-[#0f1117] text-slate-100">
      <div className="border-b border-slate-800 bg-slate-950/80 px-4 py-2">
        <div className="flex flex-wrap gap-2">
          {status.length === 0 ? (
            <span className="text-xs text-slate-500">No connector health yet</span>
          ) : (
            status.map((c) => (
              <span
                key={c.connectorId}
                className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300"
              >
                <span className={`h-2 w-2 rounded-full ${dotClass(c.lastHealthCheck?.status)}`} />
                {c.displayName}
                <span className="text-slate-500">{c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleTimeString() : "never"}</span>
              </span>
            ))
          )}
        </div>
      </div>
      <div className="flex gap-6 px-4 py-4">
        <nav className="w-44 shrink-0 space-y-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="block rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
