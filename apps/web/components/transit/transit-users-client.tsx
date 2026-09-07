"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Mail, ShieldOff, UserPlus, X } from "lucide-react";
import {
  TRANSIT_ASSIGNABLE_ROLES,
  TRANSIT_ROLE_COLORS,
  TRANSIT_ROLE_LABELS,
  type TransitAssignableRole,
} from "@/lib/transit/transit-access";

type TransitUser = {
  userId: string;
  email: string;
  role: string;
  status: "active" | "inactive" | "pending";
};

async function fetchTransitUsers(agencyId: string): Promise<TransitUser[]> {
  const res = await fetch(`/api/transit-admin/${encodeURIComponent(agencyId)}/users`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
  const data = (await res.json()) as { users?: TransitUser[] };
  return data.users ?? [];
}

async function inviteTransitUser(agencyId: string, email: string, role: TransitAssignableRole) {
  const res = await fetch(`/api/transit-admin/${encodeURIComponent(agencyId)}/users/invite`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Invite failed (${res.status})`);
  }
  return res.json();
}

async function deactivateTransitUser(agencyId: string, userId: string) {
  const res = await fetch(
    `/api/transit-admin/${encodeURIComponent(agencyId)}/users/${encodeURIComponent(userId)}/deactivate`,
    { method: "PATCH", credentials: "include" },
  );
  if (!res.ok) throw new Error(`Deactivate failed (${res.status})`);
  return res.json();
}

function roleLabel(role: string): string {
  const upper = role.trim().toUpperCase().replace(/-/g, "_") as TransitAssignableRole;
  return TRANSIT_ROLE_LABELS[upper] ?? role;
}

export function TransitUsersClient({
  transitCode,
  agencyId,
}: {
  transitCode: string;
  agencyId: string;
}) {
  const qc = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TransitAssignableRole>("TRANSIT_SUPERVISOR");
  const [formError, setFormError] = useState<string | null>(null);
  const [deactivating, setDeactivating] = useState<TransitUser | null>(null);

  const usersQ = useQuery({
    queryKey: ["transit-users", agencyId],
    queryFn: () => fetchTransitUsers(agencyId),
  });

  const inviteMutation = useMutation({
    mutationFn: () => inviteTransitUser(agencyId, email.trim(), role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["transit-users", agencyId] });
      setShowInvite(false);
      setEmail("");
      setFormError(null);
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (userId: string) => deactivateTransitUser(agencyId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["transit-users", agencyId] });
      setDeactivating(null);
    },
  });

  const users = usersQ.data ?? [];

  return (
    <div className="text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-500">
            Transit Ops — {transitCode.toUpperCase()}
          </p>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="mt-1 text-sm text-slate-400">
            Invite Transit Admin, Supervisor, Security, and Operator accounts for this agency.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 rounded-lg bg-sky-800 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
        >
          <UserPlus className="h-4 w-4" />
          Invite user
        </button>
      </div>

      {usersQ.isLoading ? (
        <p className="text-sm text-slate-400">Loading users…</p>
      ) : usersQ.isError ? (
        <p className="text-sm text-rose-400">{(usersQ.error as Error).message}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-400">No transit users yet for this agency.</p>
      ) : (
        <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800">
          {users.map((user) => (
            <li key={user.userId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-slate-500">{user.userId}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                    TRANSIT_ROLE_COLORS[
                      user.role.trim().toUpperCase().replace(/-/g, "_") as TransitAssignableRole
                    ] ?? "bg-slate-800 text-slate-300"
                  }`}
                >
                  {roleLabel(user.role)}
                </span>
                <span className="text-xs capitalize text-slate-500">{user.status}</span>
                {user.status === "active" ? (
                  <button
                    type="button"
                    onClick={() => setDeactivating(user)}
                    className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                    aria-label={`Deactivate ${user.email}`}
                  >
                    <ShieldOff className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showInvite ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold">Invite transit user</h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  Provisions a transit-role account for this tenant.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setFormError(null);
                if (!email.trim()) {
                  setFormError("Email is required");
                  return;
                }
                inviteMutation.mutate();
              }}
            >
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ops@transit.gov"
                  autoFocus
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-sky-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
                  Role
                </label>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as TransitAssignableRole)}
                    className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  >
                    {TRANSIT_ASSIGNABLE_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {TRANSIT_ASSIGNABLE_ROLES.find((r) => r.value === role)?.description}
                </p>
              </div>
              {formError ? (
                <p className="rounded-lg border border-rose-800/50 bg-rose-900/20 px-3 py-2 text-xs text-rose-400">
                  {formError}
                </p>
              ) : null}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {inviteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  Send invite
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deactivating ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border border-slate-700/60 bg-slate-900 p-6">
            <p className="text-sm text-slate-300">
              Deactivate <span className="font-medium text-white">{deactivating.email}</span>? They
              will lose access to this transit console.
            </p>
            {deactivateMutation.isError ? (
              <p className="mt-3 text-xs text-rose-400">
                {(deactivateMutation.error as Error).message}
              </p>
            ) : null}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeactivating(null)}
                className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deactivateMutation.mutate(deactivating.userId)}
                disabled={deactivateMutation.isPending}
                className="flex-1 rounded-lg bg-rose-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Deactivate
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
