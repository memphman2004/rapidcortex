"use client";

import { Radio } from "lucide-react";
import { useSession } from "@/components/auth/session-context";
import { isSupervisorOrStaffRole, SupervisorAccessRestricted } from "../../_components/supervisor-access";

export default function SupervisorWarRoomsPage() {
  const { user } = useSession();

  if (!isSupervisorOrStaffRole(user?.role)) {
    return <SupervisorAccessRestricted />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 pb-10">
      <h1 className="text-xl font-semibold text-white">War Rooms</h1>
      <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 py-16 text-center">
        <Radio className="mb-4 h-10 w-10 text-slate-600" />
        <h2 className="text-lg font-semibold text-slate-300">No active war rooms.</h2>
      </div>
    </div>
  );
}
