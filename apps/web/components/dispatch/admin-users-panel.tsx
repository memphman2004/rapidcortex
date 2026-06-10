"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSession } from "@/components/auth/session-context";
import {
  type AdminUserRow,
  isApiConfigured,
  patchAdminUser,
  postAdminCreateUser,
  postAdminDeactivateUser,
} from "@/lib/api";
import { loadAdminUsers } from "@/lib/queries";
import type { UserRole } from "rapid-cortex-shared";
import { provisionableRolesForActor } from "@/lib/auth/provisionable-roles";
import { ROLE_DISPLAY_LABELS } from "rapid-cortex-shared/auth/rapid-cortex-roles";

function randomTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let s = "";
  for (let i = 0; i < 14; i++) {
    const c = chars[Math.floor(Math.random() * chars.length)];
    if (c) s += c;
  }
  return s;
}

export function AdminUsersPanel() {
  const queryClient = useQueryClient();
  const { user: sessionUser } = useSession();
  const roleOptions = sessionUser
    ? provisionableRolesForActor(sessionUser.role)
    : provisionableRolesForActor("agencyadmin");
  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    queryFn: loadAdminUsers,
    enabled: isApiConfigured(),
  });

  const [email, setEmail] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [role, setRole] = useState<UserRole>("dispatcher");

  useEffect(() => {
    if (sessionUser?.role === "agencyadmin" && sessionUser.agencyId) {
      setAgencyId((prev) => (prev.trim() === "" ? sessionUser.agencyId : prev));
    }
  }, [sessionUser?.agencyId, sessionUser?.role]);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [createdFlash, setCreatedFlash] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () =>
      postAdminCreateUser({
        email: email.trim(),
        agencyId: agencyId.trim(),
        role,
        temporaryPassword,
      }),
    onSuccess: async (row) => {
      setFormError(null);
      setCreatedFlash(row.email);
      setEmail("");
      setAgencyId(sessionUser?.role === "agencyadmin" && sessionUser.agencyId ? sessionUser.agencyId : "");
      setRole("dispatcher");
      setTemporaryPassword("");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => setFormError(e.message),
  });

  useEffect(() => {
    if (!createdFlash) return;
    const t = window.setTimeout(() => setCreatedFlash(null), 8000);
    return () => window.clearTimeout(t);
  }, [createdFlash]);

  if (!isApiConfigured()) {
    return (
      <p className="text-sm text-amber-200/90">
        Connect the UI to your API (NEXT_PUBLIC_API_BASE or auth proxy) to manage Cognito users.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold text-white">Invite / create user</h2>
        <p className="mt-1 text-xs text-slate-500">
          Follow <span className="text-slate-400">B1</span> above. Temporary password must meet pool policy (length,
          complexity). User will set a new password on first sign-in.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Agency <span className="font-mono text-slate-400">agencyadmin</span> users can assign roles{" "}
          <span className="font-mono text-slate-400">dispatcher</span>,{" "}
          <span className="font-mono text-slate-400">supervisor</span>,{" "}
          <span className="font-mono text-slate-400">agencyadmin</span>, or{" "}
          <span className="font-mono text-slate-400">agencyit</span> only within their own{" "}
          <span className="font-mono text-slate-400">custom:agencyId</span>.{" "}
          Only Rapid Cortex <span className="text-slate-300">RC Super Admin</span> (
          <span className="font-mono text-slate-400">rcsuperadmin</span>) may assign{" "}
          <span className="font-mono text-slate-400">rcsuperadmin</span>,{" "}
          <span className="font-mono text-slate-400">rcadmin</span>, or{" "}
          <span className="font-mono text-slate-400">rcitadmin</span> when editing users in the directory below.
          Invite/create above is agency-role only.{" "}
          <span className="font-mono text-slate-400">auditor</span> and{" "}
          <span className="font-mono text-slate-400">analyst</span> are still runbook/Cognito-admin only.{" "}
          <span className="font-medium text-slate-400">Re-enabling</span> a deactivated account is not in this UI; use
          Cognito <span className="font-mono text-slate-400">AdminEnableUser</span> or the console (see{" "}
          <span className="font-mono text-slate-400">docs/USER_PROVISIONING_GUIDE.md</span>).
        </p>
        <form
          className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setFormError(null);
            createMut.mutate();
          }}
        >
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="text-slate-400">Email (username)</span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-400">Agency ID (JWT custom:agencyId)</span>
            <input
              required
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              readOnly={sessionUser?.role === "agencyadmin"}
              title={
                sessionUser?.role === "agencyadmin"
                  ? "Agency admins can only provision users for their own tenant"
                  : undefined
              }
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 read-only:cursor-not-allowed read-only:opacity-80"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-slate-400">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r} — {ROLE_DISPLAY_LABELS[r as UserRole] ?? r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs sm:col-span-2">
            <span className="text-slate-400">Temporary password</span>
            <div className="flex gap-2">
              <input
                required
                type="text"
                autoComplete="new-password"
                value={temporaryPassword}
                onChange={(e) => setTemporaryPassword(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-sm text-slate-100"
              />
              <button
                type="button"
                onClick={() => setTemporaryPassword(randomTempPassword())}
                className="shrink-0 rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700"
              >
                Generate
              </button>
            </div>
          </label>
          {formError ? <p className="text-xs text-rose-400 sm:col-span-2">{formError}</p> : null}
          {createdFlash ? (
            <p className="text-xs text-emerald-400 sm:col-span-2">
              Created <span className="font-mono text-emerald-200">{createdFlash}</span>. Share the
              temporary password through your agency&apos;s secure channel.
            </p>
          ) : null}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createMut.isPending}
              className="rounded-md bg-sky-700 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600 disabled:opacity-50"
            >
              {createMut.isPending ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-white">Directory</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Agency</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              ) : usersQuery.isError ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-rose-300">
                    Could not load users.{" "}
                    {usersQuery.error instanceof Error ? usersQuery.error.message : ""}
                  </td>
                </tr>
              ) : (usersQuery.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    No users returned (or insufficient permissions).
                  </td>
                </tr>
              ) : (
                (usersQuery.data ?? []).map((u) => (
                  <UserRow key={u.username} user={u} roleOptions={roleOptions} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function UserRow({
  user,
  roleOptions,
}: {
  user: AdminUserRow;
  roleOptions: string[];
}) {
  const { user: sessionUser } = useSession();
  const canRequirePasswordChange =
    sessionUser?.role === "agencyadmin" ||
    sessionUser?.role === "agencyit" ||
    sessionUser?.role === "rcsuperadmin" ||
    sessionUser?.role === "rcitadmin";
  const queryClient = useQueryClient();
  const [agency, setAgency] = useState(user.agencyId);
  const [role, setRole] = useState<UserRole>(user.role);

  useEffect(() => {
    setAgency(user.agencyId);
    setRole(user.role);
  }, [user.agencyId, user.role, user.username]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const nextAgency = agency.trim();
      const agencyId = nextAgency !== user.agencyId ? nextAgency : undefined;
      const rolePatch = role !== user.role ? role : undefined;
      if (agencyId === undefined && rolePatch === undefined) return;
      await patchAdminUser({
        username: user.username,
        agencyId,
        role: rolePatch,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const deactivateMut = useMutation({
    mutationFn: () => postAdminDeactivateUser(user.username),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const requirePasswordChangeMut = useMutation({
    mutationFn: () => patchAdminUser({ username: user.username, passwordChangeRequired: true }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const rowError = saveMut.isError
    ? saveMut.error instanceof Error
      ? saveMut.error.message
      : "Save failed"
    : deactivateMut.isError
      ? deactivateMut.error instanceof Error
        ? deactivateMut.error.message
        : "Deactivate failed"
      : requirePasswordChangeMut.isError
        ? requirePasswordChangeMut.error instanceof Error
          ? requirePasswordChangeMut.error.message
          : "Password requirement failed"
        : null;

  return (
    <tr className="border-b border-slate-800/80 hover:bg-slate-900/30">
      <td className="px-3 py-2">
        <div className="font-medium text-slate-100">{user.email}</div>
        <div className="font-mono text-[10px] text-slate-500">{user.username}</div>
      </td>
      <td className="px-3 py-2">
        <input
          value={agency}
          onChange={(e) => setAgency(e.target.value)}
          className="w-full min-w-[8rem] rounded border border-slate-700 bg-slate-950 px-1.5 py-1 font-mono text-[11px]"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px]"
        >
          {roleOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2 text-slate-400">
        <div>{user.status}</div>
        <div className="text-[10px] text-slate-600">{user.enabled ? "enabled" : "disabled"}</div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={
              saveMut.isPending ||
              (agency.trim() === user.agencyId && role === user.role)
            }
            onClick={() => saveMut.mutate()}
            className="rounded bg-slate-800 px-2 py-1 text-[11px] text-sky-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            disabled={deactivateMut.isPending || !user.enabled}
            onClick={() => {
              if (
                !window.confirm(
                  `Deactivate ${user.email}? They will not be able to sign in until re-enabled.`,
                )
              ) {
                return;
              }
              deactivateMut.mutate();
            }}
            className="rounded bg-rose-950/50 px-2 py-1 text-[11px] text-rose-200 ring-1 ring-rose-900 hover:bg-rose-950/80 disabled:opacity-40"
          >
            Deactivate
          </button>
          {canRequirePasswordChange ? (
            <button
              type="button"
              disabled={requirePasswordChangeMut.isPending || !user.enabled}
              onClick={() => {
                if (
                  !window.confirm(
                    "Require this user to update their password at next sign-in.",
                  )
                ) {
                  return;
                }
                requirePasswordChangeMut.mutate();
              }}
              className="rounded bg-amber-950/40 px-2 py-1 text-[11px] text-amber-100 ring-1 ring-amber-900 hover:bg-amber-950/60 disabled:opacity-40"
            >
              Require password change
            </button>
          ) : null}
          {rowError ? <p className="w-full text-[11px] text-rose-400">{rowError}</p> : null}
        </div>
      </td>
    </tr>
  );
}
