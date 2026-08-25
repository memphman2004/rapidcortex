"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { AgencyRelationship } from "rapid-cortex-shared";

export function EscalationSettingsPanel({ agencyId }: { agencyId: string }) {
  const q = useQuery({
    queryKey: ["escalation-relationship", agencyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/escalation-relationship`,
        { credentials: "include" },
      );
      const body = (await res.json()) as { relationship?: AgencyRelationship | null };
      return body.relationship ?? null;
    },
  });
  const [targetAgencyId, setTargetAgencyId] = useState("");
  const [targetPsapName, setTargetPsapName] = useState("");
  const [targetPsapPhone, setTargetPsapPhone] = useState("");
  const [psapType, setPsapType] = useState<"rc-core" | "external">("rc-core");
  const [jurisdiction, setJurisdiction] = useState("");

  const rel = q.data;
  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/rc-admin/agencies/${encodeURIComponent(agencyId)}/escalation-relationship`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetAgencyId: targetAgencyId || rel?.targetAgencyId,
            targetPsapName: targetPsapName || rel?.targetPsapName,
            targetPsapPhone: targetPsapPhone || rel?.targetPsapPhone,
            psapType,
            jurisdiction: jurisdiction || rel?.jurisdiction,
            active: true,
          }),
        },
      );
      if (!res.ok) throw new Error("Save failed");
    },
    onSuccess: () => void q.refetch(),
  });

  return (
    <div className="space-y-4 rounded-xl border border-white/10 p-4">
      <h2 className="text-sm font-semibold text-white">911 Escalation</h2>
      <p className="text-xs text-slate-400">
        Map this venue/campus agency to the PSAP that should receive Escalate to 911.
      </p>
      {rel ? (
        <p className="text-xs text-emerald-400">
          Current: {rel.targetPsapName} ({rel.psapType}) {rel.targetPsapPhone}
        </p>
      ) : (
        <p className="text-xs text-amber-400">No relationship configured.</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-400">
          Target agency ID
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
            value={targetAgencyId}
            onChange={(e) => setTargetAgencyId(e.target.value)}
            placeholder={rel?.targetAgencyId}
          />
        </label>
        <label className="text-xs text-slate-400">
          PSAP name
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
            value={targetPsapName}
            onChange={(e) => setTargetPsapName(e.target.value)}
            placeholder={rel?.targetPsapName}
          />
        </label>
        <label className="text-xs text-slate-400">
          PSAP phone
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
            value={targetPsapPhone}
            onChange={(e) => setTargetPsapPhone(e.target.value)}
            placeholder={rel?.targetPsapPhone}
          />
        </label>
        <label className="text-xs text-slate-400">
          Type
          <select
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white"
            value={psapType}
            onChange={(e) => setPsapType(e.target.value as "rc-core" | "external")}
          >
            <option value="rc-core">RC Core</option>
            <option value="external">External PSAP</option>
          </select>
        </label>
        <label className="text-xs text-slate-400 sm:col-span-2">
          Jurisdiction
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm text-white"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder={rel?.jurisdiction}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Save relationship
      </button>
    </div>
  );
}
