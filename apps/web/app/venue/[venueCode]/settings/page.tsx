"use client";

import { use, useState } from "react";
import { FIXTURE_STAFF } from "../_lib/venue-fixtures";

export default function VenueSettingsPage({
  params,
}: {
  params: Promise<{ venueCode: string }>;
}) {
  const { venueCode } = use(params);
  const [qrReporting, setQrReporting] = useState(true);
  const [smsReporting, setSmsReporting] = useState(true);
  const [photoUploads, setPhotoUploads] = useState(true);
  const [videoUploads, setVideoUploads] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState("securityops@mbsstadium.example");
  const [escalationMode, setEscalationMode] = useState("manual");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Venue configuration for {venueCode}.</p>
      </div>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Venue Information</h2>
          <button
            type="button"
            onClick={() => console.log("TODO: edit venue info")}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
          >
            Edit
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Venue Code</p>
            <p className="mt-1 text-sm text-slate-100">{venueCode}</p>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Venue Name</p>
            <p className="mt-1 text-sm text-slate-100">Mercedes-Benz Stadium</p>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">SMS Number</p>
            <p className="mt-1 text-sm text-slate-100">723389</p>
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/60 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Timezone</p>
            <p className="mt-1 text-sm text-slate-100">America/New_York</p>
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
            <label key={toggle.label} className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
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
          onClick={() =>
            console.log("TODO: save reporting config", { qrReporting, smsReporting, photoUploads, videoUploads })
          }
          className="mt-3 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Save
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
          Escalation places the incident into Rapid Cortex Core for emergency communications coordination. It does
          not automatically call 911.
        </p>
      </section>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <h2 className="text-lg font-semibold text-white">Notifications</h2>
        <label className="mt-3 flex items-center justify-between rounded-md border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
          <span>Email notification toggle for new incidents</span>
          <button
            type="button"
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
          className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Email address"
        />
        <button
          type="button"
          onClick={() => console.log("TODO: save notifications", { emailNotifications, notificationEmail })}
          className="mt-3 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800"
        >
          Save
        </button>
      </section>

      <section className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Staff Management</h2>
          <button
            type="button"
            onClick={() => console.log("TODO: invite staff member")}
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:bg-slate-800"
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
                <th className="px-3 py-2">Current Assignment</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {FIXTURE_STAFF.map((staff) => (
                <tr key={staff.id} className="border-b border-slate-800/70 bg-slate-900/20 even:bg-slate-900/40">
                  <td className="px-3 py-2 text-sm text-slate-100">{staff.name}</td>
                  <td className="px-3 py-2 text-sm text-slate-300">{staff.role}</td>
                  <td className="px-3 py-2 text-sm text-slate-300">{staff.status.replace("_", " ")}</td>
                  <td className="px-3 py-2 text-sm text-slate-300">
                    {staff.currentIncidentId ?? staff.zone ?? "None"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => console.log("TODO: edit staff", staff.id)}
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs font-semibold text-slate-100 hover:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => console.log("TODO: deactivate staff", staff.id)}
                        className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                      >
                        Deactivate
                      </button>
                    </div>
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
          onClick={() => {
            const confirmed = window.confirm("Are you sure you want to archive this venue?");
            if (confirmed) console.log("TODO: archive venue", venueCode);
          }}
          className="mt-3 rounded-md border border-red-500/50 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10"
        >
          Archive Venue
        </button>
      </section>
    </div>
  );
}
