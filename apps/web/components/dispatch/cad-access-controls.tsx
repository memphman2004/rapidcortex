"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { defaultCadScope, type CadScope } from "rapid-cortex-shared";
import { defaultPermissionForRole, isRcAdmin, isRcSuperAdmin } from "rapid-cortex-security";
import { useSession } from "@/components/auth/session-context";
import { patchUserCadAccess } from "@/lib/api";
import { useAdminCadModule } from "@/lib/hooks/use-cad-module";

const SCOPE_OPTIONS: { value: CadScope; label: string }[] = [
  { value: "FULL", label: "Full — dispatch and assign units" },
  { value: "READ_ONLY", label: "Read-only — view incidents and update unit status" },
  { value: "ADMIN", label: "Admin — manage CAD configuration" },
];

type Props = {
  agencyId: string;
  role: string;
  username?: string;
  email?: string;
  /** Saved directory rows write immediately. The invite form reports the choice upward. */
  persist: boolean;
  onChange?: (value: { enabled: boolean; cadScope: CadScope }) => void;
};

export function CadAccessControls({ agencyId, role, username, email, persist, onChange }: Props) {
  const { user: sessionUser } = useSession();
  const canAssign =
    !!sessionUser &&
    (isRcSuperAdmin(sessionUser.role) ||
      isRcAdmin(sessionUser.role) ||
      defaultPermissionForRole(sessionUser.role, "users.manage_roles"));
  const queryClient = useQueryClient();
  const query = useAdminCadModule(canAssign ? agencyId : undefined);
  const feature = query.data?.feature;
  const grant = username ? query.data?.grants?.[username] : undefined;
  const hasCad = grant?.modules?.includes("CAD") ?? false;
  const [enabled, setEnabled] = useState(hasCad);
  const [cadScope, setCadScope] = useState<CadScope>(grant?.cadScope || defaultCadScope(role));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!persist) {
      setCadScope(defaultCadScope(role));
      return;
    }
    setEnabled(hasCad);
    setCadScope(grant?.cadScope || defaultCadScope(role));
  }, [persist, hasCad, grant?.cadScope, role, username]);

  if (!canAssign || !feature?.enabled) return null;

  const remaining = query.data?.seatsRemaining ?? 0;
  const blocked = !enabled && remaining <= 0;

  function describe(): string {
    if (enabled) {
      const label = SCOPE_OPTIONS.find((option) => option.value === cadScope)?.label ?? cadScope;
      return `CAD access enabled — ${label}`;
    }
    if (remaining <= 0) return `No CAD seats remaining (${feature?.maxCadSeats ?? 0} of ${feature?.maxCadSeats ?? 0} used)`;
    return `${remaining} seat${remaining === 1 ? "" : "s"} available`;
  }

  async function commit(nextEnabled: boolean, nextScope: CadScope) {
    onChange?.({ enabled: nextEnabled, cadScope: nextScope });
    if (!persist || !username) return;
    setPending(true);
    setError(null);
    try {
      await patchUserCadAccess(agencyId, username, {
        enabled: nextEnabled,
        ...(nextEnabled ? { cadScope: nextScope } : {}),
        ...(email ? { email } : {}),
      });
      await queryClient.invalidateQueries({ queryKey: ["cad-module", agencyId] });
      await queryClient.invalidateQueries({ queryKey: ["cad-module", "self"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update CAD access");
      setEnabled(hasCad);
      setCadScope(grant?.cadScope || defaultCadScope(role));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 rounded border border-slate-800 bg-slate-950/60 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Module access</p>
      <label className="mt-1 flex items-start gap-2 text-[11px] text-slate-200">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={enabled}
          disabled={pending || blocked}
          onChange={(event) => {
            const next = event.target.checked;
            const scope = next ? defaultCadScope(role) : cadScope;
            setEnabled(next);
            if (next) setCadScope(scope);
            void commit(next, scope);
          }}
        />
        <span>
          CAD dispatch console
          <span className="mt-0.5 block text-[10px] text-slate-500">{describe()}</span>
        </span>
      </label>
      {enabled ? (
        <label className="mt-2 flex flex-col gap-1 text-[10px] text-slate-400">
          CAD access level
          <select
            value={cadScope}
            disabled={pending}
            onChange={(event) => {
              const scope = event.target.value as CadScope;
              setCadScope(scope);
              void commit(true, scope);
            }}
            className="rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px] text-slate-100"
          >
            {SCOPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {error ? <p className="mt-1 text-[10px] text-rose-300">{error}</p> : null}
    </div>
  );
}
