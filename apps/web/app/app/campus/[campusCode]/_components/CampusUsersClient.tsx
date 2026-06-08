"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, MoreHorizontal, Mail, ShieldOff, Loader2, X, ChevronDown } from "lucide-react";
import {
  CAMPUS_ASSIGNABLE_ROLES,
  CAMPUS_ROLE_COLORS,
  CAMPUS_ROLE_LABELS,
  type CampusAssignableRole,
} from "@/lib/campus/campus-access";

type CampusUser = {
  userId: string;
  email: string;
  displayName: string | null;
  role: CampusAssignableRole;
  status: "active" | "inactive" | "pending";
  lastActiveAt: string | null;
  createdAt: string;
};

type CampusInvite = {
  inviteId: string;
  email: string;
  role: CampusAssignableRole;
  sentAt: string;
  expiresAt: string;
};

async function fetchCampusUsers(agencyId: string): Promise<CampusUser[]> {
  const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/users`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
  const data = await res.json();
  return data.users ?? [];
}

async function fetchCampusInvites(agencyId: string): Promise<CampusInvite[]> {
  const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/users/invites`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load invites (${res.status})`);
  const data = await res.json();
  return data.invites ?? [];
}

async function inviteCampusUser(agencyId: string, email: string, role: CampusAssignableRole) {
  const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/users/invite`, {
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

async function deactivateCampusUser(agencyId: string, userId: string) {
  const res = await fetch(
    `/api/campus/${encodeURIComponent(agencyId)}/users/${encodeURIComponent(userId)}/deactivate`,
    { method: "PATCH", credentials: "include" },
  );
  if (!res.ok) throw new Error(`Deactivate failed (${res.status})`);
  return res.json();
}

function RoleBadge({ role }: { role: CampusAssignableRole }) {
  const colorClass = CAMPUS_ROLE_COLORS[role] ?? "bg-slate-700 text-slate-300";
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {CAMPUS_ROLE_LABELS[role] ?? role}
    </span>
  );
}

function StatusBadge({ status }: { status: CampusUser["status"] }) {
  const map = {
    active: "bg-emerald-900/50 text-emerald-400",
    inactive: "bg-slate-800 text-slate-500",
    pending: "bg-yellow-900/40 text-yellow-400",
  };
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function InviteModal({ agencyId, onClose }: { agencyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CampusAssignableRole>("CAMPUS_SECURITY");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => inviteCampusUser(agencyId, email.trim(), role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campus-users", agencyId] });
      void qc.invalidateQueries({ queryKey: ["campus-invites", agencyId] });
      onClose();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Invite campus user</h2>
            <p className="mt-0.5 text-sm text-slate-400">
              Provisions a campus-role account for this tenant.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@university.edu"
              autoFocus
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Role
            </label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as CampusAssignableRole)}
                className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                {CAMPUS_ASSIGNABLE_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {CAMPUS_ASSIGNABLE_ROLES.find((r) => r.value === role)?.description}
            </p>
          </div>

          {error ? (
            <p className="rounded-lg border border-rose-800/50 bg-rose-900/20 px-3 py-2 text-xs text-rose-400">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeactivateConfirm({
  user,
  agencyId,
  onClose,
}: {
  user: CampusUser;
  agencyId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => deactivateCampusUser(agencyId, user.userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campus-users", agencyId] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-slate-700/60 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2 text-rose-400">
          <ShieldOff className="h-4 w-4" />
          <span className="text-sm font-semibold">Deactivate user</span>
        </div>
        <p className="mt-2 text-sm text-slate-300">
          <span className="font-medium text-white">{user.email}</span> will immediately lose access
          to this campus console.
        </p>
        {mutation.isError ? (
          <p className="mt-3 text-xs text-rose-400">{(mutation.error as Error).message}</p>
        ) : null}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rose-800 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}

function UserActions({
  user,
  onDeactivate,
}: {
  user: CampusUser;
  onDeactivate: (u: CampusUser) => void;
}) {
  const [open, setOpen] = useState(false);
  if (user.status === "inactive") return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDeactivate(user);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-slate-800"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Deactivate user
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function CampusUsersClient({
  campusCode,
  agencyId,
}: {
  campusCode: string;
  agencyId: string;
  callerRole?: string;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [deactivating, setDeactivating] = useState<CampusUser | null>(null);

  const usersQ = useQuery({
    queryKey: ["campus-users", agencyId],
    queryFn: () => fetchCampusUsers(agencyId),
  });

  const invitesQ = useQuery({
    queryKey: ["campus-invites", agencyId],
    queryFn: () => fetchCampusInvites(agencyId),
  });

  const activeUsers = (usersQ.data ?? []).filter((u) => u.status === "active");
  const inactiveUsers = (usersQ.data ?? []).filter((u) => u.status === "inactive");
  const pendingInvites = invitesQ.data ?? [];

  const formatDate = (iso: string | null) => {
    if (!iso) return "Never";
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  };

  return (
    <div className="text-white">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-500">
            Campus Safety — {campusCode.toUpperCase()}
          </p>
          <h1 className="text-2xl font-semibold text-white">Users</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage who has access to this campus console. Only campus roles can be assigned here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600"
        >
          <UserPlus className="h-4 w-4" />
          Invite user
        </button>
      </div>

      {pendingInvites.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Pending invites ({pendingInvites.length})
          </h2>
          <div className="divide-y divide-slate-800 rounded-xl border border-slate-700/60 bg-slate-900">
            {pendingInvites.map((invite) => (
              <div key={invite.inviteId} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-white">{invite.email}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Invited {formatDate(invite.sentAt)} · Expires {formatDate(invite.expiresAt)}
                  </p>
                </div>
                <RoleBadge role={invite.role} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Active users ({activeUsers.length})
        </h2>

        {usersQ.isLoading ? (
          <div className="flex items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900 py-16">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        ) : usersQ.isError ? (
          <div className="rounded-xl border border-rose-800/30 bg-rose-900/10 px-4 py-8 text-center text-sm text-rose-400">
            Failed to load users. Check your connection and try again.
          </div>
        ) : activeUsers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 px-4 py-12 text-center">
            <p className="text-sm text-slate-500">No active users yet.</p>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              className="mt-3 text-sm text-slate-400 underline underline-offset-2 hover:text-white"
            >
              Invite the first user
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    User
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Role
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Last active
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activeUsers.map((user) => (
                  <tr key={user.userId} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{user.displayName ?? user.email}</p>
                      {user.displayName ? (
                        <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDate(user.lastActiveAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <UserActions user={user} onDeactivate={setDeactivating} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inactiveUsers.length > 0 ? (
        <section>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Inactive ({inactiveUsers.length})
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50">
            <table className="w-full text-sm opacity-60">
              <tbody className="divide-y divide-slate-800/40">
                {inactiveUsers.map((user) => (
                  <tr key={user.userId}>
                    <td className="px-4 py-3 text-slate-400">{user.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status="inactive" />
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {formatDate(user.lastActiveAt)}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showInvite ? <InviteModal agencyId={agencyId} onClose={() => setShowInvite(false)} /> : null}
      {deactivating ? (
        <DeactivateConfirm
          user={deactivating}
          agencyId={agencyId}
          onClose={() => setDeactivating(null)}
        />
      ) : null}
    </div>
  );
}
