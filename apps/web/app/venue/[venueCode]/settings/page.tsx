"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/components/auth/session-context";
import { VenueCapacityField } from "@/components/venue/venue-capacity-field";
import {
  fetchAdminUsers,
  postAdminCreateUser,
  postAdminDeactivateUser,
} from "@/lib/api";
import { fetchVenueOnDuty } from "@/lib/venue/venue-dashboard-api";
import { fetchVenueProfile, patchVenueProfile } from "@/lib/venue/venue-profile-api";

export default function VenueSettingsPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);
  const normalizedVenueCode = venueCode.toUpperCase().replace(/-/g, "");
  const { user } = useSession();
  const agencyId = user?.agencyId ?? "";

  const [venueName, setVenueName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [qrReporting, setQrReporting] = useState(true);
  const [smsReporting, setSmsReporting] = useState(true);
  const [photoUploads, setPhotoUploads] = useState(true);
  const [videoUploads, setVideoUploads] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState("");
  const [escalationMode, setEscalationMode] = useState("manual");
  const [staffRows, setStaffRows] = useState<
    { userId: string; displayName: string; role: string; status: string; zone: string }[]
  >([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await fetchVenueProfile(normalizedVenueCode);
      if (!profile) return;
      setVenueName(profile.venueName);
      if (profile.timezone) setTimezone(profile.timezone);
      if (typeof profile.qrEnabled === "boolean") setQrReporting(profile.qrEnabled);
      if (typeof profile.smsEnabled === "boolean") setSmsReporting(profile.smsEnabled);
      if (typeof profile.photoUploadsEnabled === "boolean") {
        setPhotoUploads(profile.photoUploadsEnabled);
      }
      if (typeof profile.videoUploadsEnabled === "boolean") {
        setVideoUploads(profile.videoUploadsEnabled);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load venue profile");
    }
  }, [normalizedVenueCode]);

  const loadStaff = useCallback(async () => {
    if (!agencyId) return;
    try {
      const [onDuty, adminUsers] = await Promise.all([
        fetchVenueOnDuty(agencyId).catch(() => []),
        fetchAdminUsers().catch(() => []),
      ]);
      const venueUsers = adminUsers.filter((row) => row.agencyId === agencyId);
      if (venueUsers.length > 0) {
        setStaffRows(
          venueUsers.map((row) => ({
            userId: row.username,
            displayName: row.email,
            role: row.role,
            status: row.enabled ? "active" : "inactive",
            zone: "—",
          })),
        );
      } else {
        setStaffRows(
          onDuty.map((member) => ({
            userId: member.userId,
            displayName: member.displayName,
            role: member.role,
            status: member.status,
            zone: member.zone,
          })),
        );
      }
    } catch {
      setStaffRows([]);
    }
  }, [agencyId]);

  useEffect(() => {
    void loadProfile();
    void loadStaff();
  }, [loadProfile, loadStaff]);

  const saveReporting = async () => {
    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await patchVenueProfile(normalizedVenueCode, {
        qrEnabled: qrReporting,
        smsEnabled: smsReporting,
        photoUploadsEnabled: photoUploads,
        videoUploadsEnabled: videoUploads,
      });
      setStatusMessage("Reporting configuration saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save reporting settings");
    } finally {
      setSaving(false);
    }
  };

  const saveVenueInfo = async () => {
    setSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await patchVenueProfile(normalizedVenueCode, {
        venueName: venueName.trim() || undefined,
        timezone: timezone.trim() || undefined,
      });
      setStatusMessage("Venue information saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save venue information");
    } finally {
      setSaving(false);
    }
  };

  const archiveVenue = async () => {
    const confirmed = window.confirm("Are you sure you want to archive this venue?");
    if (!confirmed) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await patchVenueProfile(normalizedVenueCode, { active: false });
      setStatusMessage("Venue archived.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to archive venue");
    } finally {
      setSaving(false);
    }
  };

  const inviteStaff = async () => {
    const email = window.prompt("Staff member email address");
    if (!email?.trim() || !agencyId) return;
    const role = window.prompt("Role (e.g. venue_security, venue_guest)", "venue_security");
    if (!role?.trim()) return;
    const temporaryPassword = window.prompt("Temporary password (min 12 chars)") ?? "";
    if (temporaryPassword.length < 12) {
      setErrorMessage("Temporary password must be at least 12 characters.");
      return;
    }
    setSaving(true);
    setErrorMessage(null);
    try {
      await postAdminCreateUser({
        email: email.trim(),
        agencyId,
        role: role.trim() as never,
        temporaryPassword,
      });
      setStatusMessage("Staff invite sent.");
      await loadStaff();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to invite staff");
    } finally {
      setSaving(false);
    }
  };

  const deactivateStaff = async (username: string) => {
    const confirmed = window.confirm(`Deactivate ${username}?`);
    if (!confirmed) return;
    setSaving(true);
    setErrorMessage(null);
    try {
      await postAdminDeactivateUser(username);
      setStatusMessage("Staff member deactivated.");
      await loadStaff();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to deactivate staff");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Venue configuration for {venueCode}.</p>
      </div>

      {statusMessage ? (
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {errorMessage}
        </p>
      ) : null}

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Venue Information</h2>
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveVenueInfo()}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            Save
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Venue Code</p>
            <p className="mt-1 text-sm text-slate-100">{normalizedVenueCode}</p>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
            <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="venue-name">
              Venue Name
            </label>
            <input
              id="venue-name"
              value={venueName}
              onChange={(event) => setVenueName(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            />
          </div>
          <VenueCapacityField venueCode={normalizedVenueCode} />
          <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Section layout</p>
            <p className="mt-1 text-sm text-slate-300">
              Configure bowl sections, levels, and SVG positions.
            </p>
            <Link
              href={`/app/venue/${normalizedVenueCode}/sections`}
              className="mt-2 inline-flex rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/20"
            >
              Open section configuration
            </Link>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
            <label className="text-xs uppercase tracking-wide text-slate-500" htmlFor="venue-timezone">
              Timezone
            </label>
            <input
              id="venue-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold text-white">Reporting Configuration</h2>
        <div className="mt-3 space-y-3">
          {[
            { label: "QR Code Reporting", value: qrReporting, setter: setQrReporting },
            { label: "SMS Reporting", value: smsReporting, setter: setSmsReporting },
            { label: "Photo uploads from guests", value: photoUploads, setter: setPhotoUploads },
            { label: "Video uploads from guests", value: videoUploads, setter: setVideoUploads },
          ].map((toggle) => (
            <label
              key={toggle.label}
              className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200"
            >
              <span>{toggle.label}</span>
              <button
                type="button"
                onClick={() => toggle.setter(!toggle.value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  toggle.value
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                    : "border-slate-700 bg-slate-900 text-slate-300"
                }`}
              >
                {toggle.value ? "On" : "Off"}
              </button>
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void saveReporting()}
          className="mt-3 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
        >
          Save reporting settings
        </button>
      </section>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold text-white">Escalation Settings</h2>
        <select
          value={escalationMode}
          onChange={(event) => setEscalationMode(event.target.value)}
          className="mt-3 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        >
          <option value="manual">Manual only</option>
          <option value="auto_15">Auto after 15 min</option>
        </select>
        <p className="mt-2 text-xs text-slate-500">
          Escalation mode is stored locally until venue escalation API ships. Escalation does not
          automatically call 911.
        </p>
      </section>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold text-white">Notifications</h2>
        <label className="mt-3 flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
          <span>
            Email notification toggle for new incidents
            <span className="ml-2 text-xs text-slate-500">(API pending)</span>
          </span>
          <button
            type="button"
            disabled
            onClick={() => setEmailNotifications((current) => !current)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              emailNotifications
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-slate-700 bg-slate-900 text-slate-300"
            }`}
          >
            {emailNotifications ? "On" : "Off"}
          </button>
        </label>
        <input
          value={notificationEmail}
          onChange={(event) => setNotificationEmail(event.target.value)}
          disabled
          className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Email address (API pending)"
        />
      </section>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Staff Management</h2>
          <button
            type="button"
            disabled={saving || !agencyId}
            onClick={() => void inviteStaff()}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50"
          >
            Invite Staff Member
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-800/60 text-left text-xs uppercase tracking-wide text-slate-300">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Zone</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffRows.map((staff) => (
                <tr key={staff.userId} className="border-b border-slate-800/70 bg-slate-900/20 even:bg-slate-900/40">
                  <td className="px-3 py-2 text-sm text-slate-100">{staff.displayName}</td>
                  <td className="px-3 py-2 text-sm text-slate-300">{staff.role}</td>
                  <td className="px-3 py-2 text-sm text-slate-300">{staff.status.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-sm text-slate-300">{staff.zone}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={saving || staff.status === "inactive"}
                      onClick={() => void deactivateStaff(staff.userId)}
                      className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-red-500/40 bg-red-500/5 p-4">
        <h2 className="text-lg font-semibold text-red-200">Danger Zone</h2>
        <p className="mt-1 text-sm text-red-100/80">Archive this venue and lock all new incident intake.</p>
        <button
          type="button"
          disabled={saving}
          onClick={() => void archiveVenue()}
          className="mt-3 rounded-md border border-red-500/50 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-50"
        >
          Archive Venue
        </button>
      </section>
    </div>
  );
}
