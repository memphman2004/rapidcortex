"use client";

import { Lock } from "lucide-react";

export function isSupervisorOrStaffRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (
    role === "supervisor" ||
    role === "rcsuperadmin" ||
    role === "rcadmin" ||
    role === "rcitadmin"
  );
}

export function SupervisorAccessRestricted() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Lock className="mb-4 h-10 w-10 text-slate-600" />
      <h2 className="text-lg font-semibold text-slate-300">Access Restricted</h2>
      <p className="mt-2 text-sm text-slate-500">This area requires supervisor access.</p>
    </div>
  );
}
