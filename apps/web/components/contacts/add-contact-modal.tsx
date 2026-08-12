"use client";

import { useEffect, useState } from "react";
import type { ContactPerson, CreateContactBody, OutreachStatus } from "rapid-cortex-shared";

type Props = {
  open: boolean;
  companyName: string;
  initial?: ContactPerson | null;
  onClose: () => void;
  onSubmit: (body: CreateContactBody) => Promise<void>;
};

export function AddContactModal({ open, companyName, initial, onClose, onSubmit }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phone, setPhone] = useState("");
  const [mobilePhone, setMobilePhone] = useState("");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [location, setLocation] = useState("");
  const [outreachStatus, setOutreachStatus] = useState<OutreachStatus>("not_contacted");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setFirstName(initial.firstName);
      setLastName(initial.lastName);
      setTitle(initial.title ?? "");
      setDepartment(initial.department ?? "");
      setEmail(initial.email ?? "");
      setEmailVerified(initial.emailVerified);
      setPhone(initial.phone ?? "");
      setMobilePhone(initial.mobilePhone ?? "");
      setLinkedInUrl(initial.linkedInUrl ?? "");
      setLocation(initial.location ?? "");
      setOutreachStatus(initial.outreachStatus);
      setNotes(initial.notes ?? "");
    } else {
      setFirstName("");
      setLastName("");
      setTitle("");
      setDepartment("");
      setEmail("");
      setEmailVerified(false);
      setPhone("");
      setMobilePhone("");
      setLinkedInUrl("");
      setLocation("");
      setOutreachStatus("not_contacted");
      setNotes("");
    }
  }, [open, initial]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        title: title.trim() || null,
        department: department.trim() || null,
        email: email.trim() || null,
        emailVerified,
        phone: phone.trim() || null,
        mobilePhone: mobilePhone.trim() || null,
        linkedInUrl: linkedInUrl.trim() || null,
        location: location.trim() || null,
        outreachStatus,
        notes: notes.trim() || null,
        source: initial?.source ?? "manual",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-5 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-white">
          {initial ? "Edit Contact" : "Add Contact"}
        </h2>
        <p className="mt-1 text-xs text-slate-500">{companyName}</p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <label className="block">
            <span className="text-slate-400">First Name *</span>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-slate-400">Last Name *</span>
            <input
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-slate-400">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-slate-400">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="mt-6 flex items-center gap-2 text-slate-400">
            <input
              type="checkbox"
              checked={emailVerified}
              onChange={(e) => setEmailVerified(e.target.checked)}
            />
            Email verified
          </label>
          <label className="block">
            <span className="text-slate-400">Phone</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block">
            <span className="text-slate-400">Mobile</span>
            <input
              value={mobilePhone}
              onChange={(e) => setMobilePhone(e.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-slate-400">Outreach Status</span>
            <select
              value={outreachStatus}
              onChange={(e) => setOutreachStatus(e.target.value as OutreachStatus)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            >
              <option value="not_contacted">Not Contacted</option>
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="meeting_set">Meeting Set</option>
              <option value="closed">Closed</option>
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="text-slate-400">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100"
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
