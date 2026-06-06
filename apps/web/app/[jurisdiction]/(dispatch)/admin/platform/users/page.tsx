"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { CrossTenantUserTable } from "@/components/platform/cross-tenant-user-table";
import {
  fetchAgencies,
  fetchAdminUsers,
  type AdminUserRow,
  postAdminActivateUser,
  postAdminCreateUser,
  postAdminDeactivateUser,
} from "@/lib/api";
import type { UserRole } from "rapid-cortex-shared";
import { RAPID_CORTEX_ROLES } from "rapid-cortex-shared/auth/rapid-cortex-roles";
import { provisionableRolesForActor } from "@/lib/auth/provisionable-roles";
import { useSession } from "@/components/auth/session-context";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";

export default function PlatformUsersPage() {
  const { user: sessionUser } = useSession();
  const assignableRoles = sessionUser
    ? provisionableRolesForActor(sessionUser.role)
    : provisionableRolesForActor("rcsuperadmin");
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });
  const agenciesQ = useQuery({ queryKey: ["agencies"], queryFn: fetchAgencies });

  const [search, setSearch] = useState("");
  const [agencyFilter, setAgencyFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [activeOnly, setActiveOnly] = useState<"" | "yes" | "no">("");

  const [create, setCreate] = useState({
    email: "",
    agencyId: "",
    role: "agencyadmin" as UserRole,
    tempPassword: "",
  });

  const createMut = useMutation({
    mutationFn: () =>
      postAdminCreateUser({
        email: create.email.trim(),
        agencyId: create.agencyId.trim(),
        role: create.role,
        temporaryPassword: create.tempPassword,
      }),
    onSuccess: async () => {
      setCreate((c) => ({ ...c, email: "", tempPassword: "" }));
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const filtered = useMemo(() => {
    let list = [...(usersQ.data ?? [])];
    if (agencyFilter) list = list.filter((u) => u.agencyId === agencyFilter);
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (activeOnly === "yes") list = list.filter((u) => u.enabled);
    if (activeOnly === "no") list = list.filter((u) => !u.enabled);
    return list;
  }, [usersQ.data, agencyFilter, roleFilter, activeOnly]);

  const onUsersChanged = () => {
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white">Users (all tenants)</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Cognito pool list (capped) with cross-tenant filters. To grant an individual user extra features
          or dashboards, use{" "}
          <Link href="/rc-admin/access" className="text-sky-300 hover:underline">
            Feature access
          </Link>
          . Agency admins only see their org from the standard{" "}
          <Link href={to("/admin/users")} className="text-sky-300 hover:underline">
            Users
          </Link>{" "}
          page.
        </p>
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Create user / first admin
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Uses admin create API. User receives temporary password; follow your runbook to deliver securely.
        </p>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMut.mutate();
          }}
        >
          <label className="text-sm">
            <span className="text-slate-400">Email (username)</span>
            <input
              type="email"
              required
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              value={create.email}
              onChange={(e) => setCreate((c) => ({ ...c, email: e.target.value }))}
            />
          </label>
          <label className="text-sm">
            <span className="text-slate-400">Agency</span>
            <select
              required
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm font-mono"
              value={create.agencyId}
              onChange={(e) => setCreate((c) => ({ ...c, agencyId: e.target.value }))}
            >
              <option value="">—</option>
              {(agenciesQ.data ?? []).map((a) => (
                <option key={a.agencyId} value={a.agencyId}>
                  {a.agencyId}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-slate-400">Role</span>
            <select
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              value={create.role}
              onChange={(e) => setCreate((c) => ({ ...c, role: e.target.value as UserRole }))}
            >
              {assignableRoles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2 lg:col-span-1">
            <span className="text-slate-400">Temporary password</span>
            <input
              type="password"
              required
              className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              value={create.tempPassword}
              onChange={(e) => setCreate((c) => ({ ...c, tempPassword: e.target.value }))}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="rounded-md bg-rose-900/50 px-3 py-1.5 text-sm font-medium text-rose-50 ring-1 ring-rose-500/30 hover:bg-rose-900/70 disabled:opacity-50"
            >
              {createMut.isPending ? "Creating…" : "Create user"}
            </button>
          </div>
        </form>
        {createMut.isError ? (
          <p className="mt-2 text-xs text-rose-300">
            {createMut.error instanceof Error ? createMut.error.message : "Create failed"}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex max-w-md flex-1 items-center gap-2 rounded-md border border-slate-800 bg-slate-900/50 px-2 py-1.5">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm"
            placeholder="Search email, username, agency, role"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="text-xs text-slate-500">
          Agency
          <select
            className="ml-1 rounded border border-slate-800 bg-slate-950 px-1 py-0.5 text-slate-200"
            value={agencyFilter}
            onChange={(e) => setAgencyFilter(e.target.value)}
          >
            <option value="">All</option>
            {(agenciesQ.data ?? []).map((a) => (
              <option key={a.agencyId} value={a.agencyId}>
                {a.agencyId}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Role
          <select
            className="ml-1 rounded border border-slate-800 bg-slate-950 px-1 py-0.5"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All</option>
            {RAPID_CORTEX_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Enabled
          <select
            className="ml-1 rounded border border-slate-800 bg-slate-950 px-1 py-0.5"
            value={activeOnly}
            onChange={(e) => setActiveOnly(e.target.value as "" | "yes" | "no")}
          >
            <option value="">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
      </div>

      {usersQ.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : usersQ.isError ? (
        <p className="text-sm text-rose-300">Failed to load users.</p>
      ) : (
        <CrossTenantUserTable
          users={filtered}
          search={search}
          renderActions={(u) => <UserActionCell u={u} onChanged={onUsersChanged} />}
        />
      )}
    </div>
  );
}

function UserActionCell({ u, onChanged }: { u: AdminUserRow; onChanged: () => void }) {
  const disableMut = useMutation({
    mutationFn: () => postAdminDeactivateUser(u.username),
    onSuccess: onChanged,
  });
  const activMut = useMutation({
    mutationFn: () => postAdminActivateUser(u.username),
    onSuccess: onChanged,
  });
  return u.enabled ? (
    <button
      type="button"
      disabled={disableMut.isPending}
      onClick={() => disableMut.mutate()}
      className="rounded bg-rose-950/40 px-2 py-0.5 text-rose-200 ring-1 ring-rose-500/20 hover:bg-rose-950/60 disabled:opacity-50"
    >
      Disable
    </button>
  ) : (
    <button
      type="button"
      disabled={activMut.isPending}
      onClick={() => activMut.mutate()}
      className="rounded bg-emerald-950/30 px-2 py-0.5 text-emerald-200 ring-1 ring-emerald-500/20 hover:bg-emerald-950/50 disabled:opacity-50"
    >
      Reactivate
    </button>
  );
}
