"use client";

/**
 * Campus K-12 Volunteer & Contractor Management
 *
 * Tracks recurring visitors (parent volunteers, coaches, tutors, contractors)
 * including background check status and NSOPW screening results.
 *
 * IMPORTANT: Access decisions are always made by human staff. Advisory status
 * displayed here (Cleared / Pending / Flagged / Expired) never automatically
 * denies entry — it surfaces information for staff to act on.
 */

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserCheck,
  UserX,
  UserPlus,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Filter,
} from "lucide-react";
import { campusRoleFamily } from "rapid-cortex-shared";
import type {
  CampusVolunteerSummary,
  CampusBgCheckStatus,
  CampusVolunteerUpsertBody,
} from "rapid-cortex-shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  agencyId: string;
  campusCode: string;
  userRole: string;
}

type AccessAdvisory = "cleared" | "flagged" | "pending" | "expired" | "unknown";

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchVolunteers(
  agencyId: string,
  filter?: { bgCheckStatus?: CampusBgCheckStatus },
): Promise<CampusVolunteerSummary[]> {
  const params = new URLSearchParams();
  if (filter?.bgCheckStatus) params.set("bgCheckStatus", filter.bgCheckStatus);
  const res = await fetch(
    `/api/campus/${agencyId}/volunteers${params.toString() ? `?${params}` : ""}`,
  );
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data.volunteers ?? []) as CampusVolunteerSummary[];
}

async function createVolunteer(
  agencyId: string,
  body: CampusVolunteerUpsertBody,
): Promise<CampusVolunteerSummary> {
  const res = await fetch(`/api/campus/${agencyId}/volunteers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.volunteer as CampusVolunteerSummary;
}

async function runNsopwRecheck(
  agencyId: string,
  volunteerId: string,
): Promise<{ nsopwStatus: string; accessAdvisory: AccessAdvisory }> {
  const res = await fetch(
    `/api/campus/${agencyId}/volunteers/${volunteerId}/nsopw-check`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAdvisoryFromVolunteer(v: CampusVolunteerSummary): AccessAdvisory {
  if (v.nsopwStatus === "flagged") return "flagged";
  if (v.bgCheckStatus === "flagged") return "flagged";
  if (v.bgCheckStatus === "expired") return "expired";
  if (v.bgCheckExpiresAt && new Date(v.bgCheckExpiresAt) < new Date()) return "expired";
  if (v.bgCheckStatus === "pending") return "pending";
  if (
    v.bgCheckStatus === "cleared" &&
    (v.nsopwStatus === "cleared" || v.nsopwStatus === "not_checked")
  )
    return "cleared";
  if (v.bgCheckStatus === "not_required" && v.nsopwStatus === "cleared") return "cleared";
  return "unknown";
}

function AdvisoryBadge({ advisory }: { advisory: AccessAdvisory }) {
  const config: Record<
    AccessAdvisory,
    { label: string; className: string; icon: React.ReactNode }
  > = {
    cleared: {
      label: "Cleared",
      className: "bg-green-900/40 text-green-400 border border-green-700/50",
      icon: <CheckCircle className="h-3 w-3" />,
    },
    flagged: {
      label: "Flagged — Review",
      className: "bg-red-900/40 text-red-400 border border-red-700/50",
      icon: <UserX className="h-3 w-3" />,
    },
    pending: {
      label: "Pending",
      className: "bg-amber-900/40 text-amber-400 border border-amber-700/50",
      icon: <Clock className="h-3 w-3" />,
    },
    expired: {
      label: "Expired",
      className: "bg-orange-900/40 text-orange-400 border border-orange-700/50",
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    unknown: {
      label: "Not Checked",
      className: "bg-slate-800/60 text-slate-400 border border-slate-700/50",
      icon: <Shield className="h-3 w-3" />,
    },
  };
  const { label, className, icon } = config[advisory];
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${className}`}>
      {icon}
      {label}
    </span>
  );
}

function roleBadgeLabel(role: string): string {
  const labels: Record<string, string> = {
    parent_volunteer: "Parent Volunteer",
    coach: "Coach",
    tutor: "Tutor",
    contractor: "Contractor",
    vendor: "Vendor",
    field_trip_chaperone: "Field Trip Chaperone",
    mentor: "Mentor",
    other: "Other",
  };
  return labels[role] ?? role;
}

// ---------------------------------------------------------------------------
// Add volunteer form
// ---------------------------------------------------------------------------

const ROLES = [
  { value: "parent_volunteer", label: "Parent Volunteer" },
  { value: "coach", label: "Coach / Athletic Staff" },
  { value: "tutor", label: "Tutor / Mentor" },
  { value: "field_trip_chaperone", label: "Field Trip Chaperone" },
  { value: "contractor", label: "Contractor" },
  { value: "vendor", label: "Vendor" },
  { value: "other", label: "Other" },
];

const BG_STATUSES = [
  { value: "not_required", label: "Not Required" },
  { value: "pending", label: "Pending — Check in progress" },
  { value: "cleared", label: "Cleared" },
  { value: "flagged", label: "Flagged" },
  { value: "expired", label: "Expired" },
];

interface AddFormState {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  role: string;
  bgCheckStatus: string;
  bgCheckProvider: string;
  notes: string;
}

const EMPTY_FORM: AddFormState = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  role: "parent_volunteer",
  bgCheckStatus: "not_required",
  bgCheckProvider: "",
  notes: "",
};

function AddVolunteerModal({
  agencyId,
  onClose,
  onSaved,
}: {
  agencyId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<AddFormState>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await createVolunteer(agencyId, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        role: form.role as CampusVolunteerUpsertBody["role"],
        bgCheckStatus: form.bgCheckStatus as CampusBgCheckStatus || undefined,
        bgCheckProvider: form.bgCheckProvider.trim() || undefined,
        notes: form.notes.trim() || undefined,
        allowedSites: [],
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add volunteer");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-white">Add Volunteer / Contractor</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">First Name *</label>
              <input
                required
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Last Name *</label>
              <input
                required
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Role *</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Background Check Status</label>
              <select
                value={form.bgCheckStatus}
                onChange={(e) => setForm((f) => ({ ...f, bgCheckStatus: e.target.value }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              >
                {BG_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">BG Check Provider</label>
              <input
                value={form.bgCheckProvider}
                onChange={(e) => setForm((f) => ({ ...f, bgCheckProvider: e.target.value }))}
                placeholder="e.g. District HR, DOJ Live Scan"
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-sky-500 focus:outline-none"
            />
          </div>
          {error && (
            <p className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-400">{error}</p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {isSubmitting ? "Adding…" : "Add & Screen"}
            </button>
          </div>
        </form>
        <p className="mt-3 text-xs text-slate-500">
          NSOPW national sex offender registry check will run automatically.
          Advisory status is for staff reference only — NexCort iQ never automatically denies access.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CampusVolunteersClient({ agencyId, campusCode, userRole }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);

  const roleFamily = campusRoleFamily(userRole);
  const canWrite = roleFamily === "admin" || roleFamily === "supervisor";

  const { data: volunteers = [], isLoading, error, refetch } = useQuery({
    queryKey: ["campus-volunteers", agencyId],
    queryFn: () => fetchVolunteers(agencyId),
  });

  const handleNsopwRecheck = useCallback(
    async (volunteerId: string) => {
      setRecheckingId(volunteerId);
      try {
        await runNsopwRecheck(agencyId, volunteerId);
        queryClient.invalidateQueries({ queryKey: ["campus-volunteers", agencyId] });
      } catch (err) {
        console.error("NSOPW re-check failed", err);
      } finally {
        setRecheckingId(null);
      }
    },
    [agencyId, queryClient],
  );

  const filtered = volunteers.filter((v) => {
    const name = `${v.firstName} ${v.lastName}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const advisory = getAdvisoryFromVolunteer(v);
    const matchStatus = statusFilter === "all" || advisory === statusFilter;
    return matchSearch && matchStatus && !v.archivedAt;
  });

  const counts = {
    total: volunteers.filter((v) => !v.archivedAt).length,
    flagged: volunteers.filter((v) => !v.archivedAt && getAdvisoryFromVolunteer(v) === "flagged").length,
    pending: volunteers.filter((v) => !v.archivedAt && getAdvisoryFromVolunteer(v) === "pending").length,
    expired: volunteers.filter((v) => !v.archivedAt && getAdvisoryFromVolunteer(v) === "expired").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Volunteer & Contractor Registry</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            Background check status and NSOPW screening for recurring campus visitors.
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
          >
            <UserPlus className="h-4 w-4" />
            Add Volunteer
          </button>
        )}
      </div>

      {/* Advisory disclaimer */}
      <div className="rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3">
        <p className="text-xs text-amber-300">
          <strong>Advisory notice:</strong> Status shown here is for staff reference only. NexCort iQ
          never automatically denies entry — human staff make all access decisions.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, color: "text-white" },
          { label: "Flagged", value: counts.flagged, color: "text-red-400" },
          { label: "Pending", value: counts.pending, color: "text-amber-400" },
          { label: "Expired", value: counts.expired, color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-700/50 bg-slate-800/60 p-3">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          {["all", "cleared", "pending", "flagged", "expired"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${
                statusFilter === s
                  ? "bg-sky-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetch()}
          className="rounded-lg p-2 text-slate-400 hover:text-white"
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400">Loading volunteers…</div>
      ) : error ? (
        <div className="rounded-lg border border-red-700/50 bg-red-900/20 px-4 py-3 text-sm text-red-400">
          Failed to load volunteers. This feature may not be provisioned in this environment.
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          {volunteers.length === 0
            ? "No volunteers added yet. Add the first volunteer above."
            : "No volunteers match the current filter."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-700/50">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700/50 bg-slate-800/80">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-300">Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">Role</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">Status</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">NSOPW</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">BG Check</th>
                <th className="px-4 py-3 text-left font-medium text-slate-300">BG Expires</th>
                {canWrite && (
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filtered.map((v) => {
                const advisory = getAdvisoryFromVolunteer(v);
                const isRechecking = recheckingId === v.volunteerId;
                return (
                  <tr key={v.volunteerId} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">
                        {v.firstName} {v.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Added {new Date(v.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{roleBadgeLabel(v.role)}</td>
                    <td className="px-4 py-3">
                      <AdvisoryBadge advisory={advisory} />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs ${
                          v.nsopwStatus === "flagged"
                            ? "text-red-400"
                            : v.nsopwStatus === "cleared"
                              ? "text-green-400"
                              : v.nsopwStatus === "review_required"
                                ? "text-amber-400"
                                : "text-slate-500"
                        }`}
                      >
                        {v.nsopwStatus === "not_checked"
                          ? "Not checked"
                          : v.nsopwStatus === "cleared"
                            ? "Cleared"
                            : v.nsopwStatus === "flagged"
                              ? "Flagged"
                              : "Review required"}
                      </span>
                      {v.nsopwCheckedAt && (
                        <p className="text-xs text-slate-600">
                          {new Date(v.nsopwCheckedAt).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`capitalize text-xs ${
                          v.bgCheckStatus === "cleared"
                            ? "text-green-400"
                            : v.bgCheckStatus === "flagged"
                              ? "text-red-400"
                              : v.bgCheckStatus === "pending"
                                ? "text-amber-400"
                                : v.bgCheckStatus === "expired"
                                  ? "text-orange-400"
                                  : "text-slate-500"
                        }`}
                      >
                        {v.bgCheckStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {v.bgCheckExpiresAt
                        ? new Date(v.bgCheckExpiresAt).toLocaleDateString()
                        : "—"}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleNsopwRecheck(v.volunteerId)}
                          disabled={isRechecking}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-sky-400 hover:bg-sky-900/30 disabled:opacity-50"
                          title="Re-run NSOPW check"
                        >
                          <RefreshCw className={`h-3 w-3 ${isRechecking ? "animate-spin" : ""}`} />
                          Recheck
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddVolunteerModal
          agencyId={agencyId}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ["campus-volunteers", agencyId] });
          }}
        />
      )}
    </div>
  );
}
