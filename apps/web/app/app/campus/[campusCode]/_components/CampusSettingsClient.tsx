"use client";

import { useState, type ElementType, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Bell,
  AlertTriangle,
  QrCode,
  Save,
  Loader2,
  Check,
  ChevronDown,
} from "lucide-react";
import type { CampusSettingsView } from "@/lib/campus/campus-settings-mapper";

async function fetchCampusSettings(agencyId: string): Promise<CampusSettingsView> {
  const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
  return res.json();
}

async function saveCampusSettings(agencyId: string, settings: Partial<CampusSettingsView>) {
  const res = await fetch(`/api/campus/${encodeURIComponent(agencyId)}/settings`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `Save failed (${res.status})`);
  }
  return res.json();
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800">
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-400">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
    />
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-slate-500" : "bg-slate-700"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </button>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  );
}

function SaveBar({
  isDirty,
  isPending,
  isSuccess,
  onSave,
}: {
  isDirty: boolean;
  isPending: boolean;
  isSuccess: boolean;
  onSave: () => void;
}) {
  if (!isDirty && !isSuccess) return null;
  return (
    <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-800 bg-slate-950/90 px-6 py-3 backdrop-blur">
      <p className="text-xs text-slate-500">
        {isSuccess ? "Changes saved." : "You have unsaved changes."}
      </p>
      <button
        type="button"
        onClick={onSave}
        disabled={isPending || !isDirty}
        className="flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-500 disabled:opacity-50"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isSuccess ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {isPending ? "Saving…" : isSuccess ? "Saved" : "Save changes"}
      </button>
    </div>
  );
}

export function CampusSettingsClient({
  campusCode,
  agencyId,
}: {
  campusCode: string;
  agencyId: string;
}) {
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["campus-settings", agencyId],
    queryFn: () => fetchCampusSettings(agencyId),
  });

  const [draft, setDraft] = useState<Partial<CampusSettingsView>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const update = <K extends keyof CampusSettingsView>(
    section: K,
    value: Partial<CampusSettingsView[K]>,
  ) => {
    setDraft((d) => ({
      ...d,
      [section]: { ...(data?.[section] ?? {}), ...(d[section] ?? {}), ...value },
    }));
    setIsDirty(true);
    setSavedOk(false);
  };

  const merged: CampusSettingsView = {
    general: {
      displayName: "",
      campusType: "university",
      timezone: "America/New_York",
      ...(data?.general ?? {}),
      ...(draft.general ?? {}),
    },
    notifications: {
      newIncidentEmails: [],
      escalationEmails: [],
      newIncidentSms: [],
      escalationSms: [],
      ...(data?.notifications ?? {}),
      ...(draft.notifications ?? {}),
    },
    escalation: {
      enabled: false,
      thresholdMinutes: 15,
      escalationContacts: [],
      ...(data?.escalation ?? {}),
      ...(draft.escalation ?? {}),
    },
    publicForm: {
      title: "Report a Safety Concern",
      instructions: "",
      collectName: true,
      collectPhone: false,
      collectLocation: true,
      customFields: [],
      disclaimerText:
        "This form is not monitored 24/7 and is not a substitute for calling 911 in an emergency.",
      ...(data?.publicForm ?? {}),
      ...(draft.publicForm ?? {}),
    },
  };

  const mutation = useMutation({
    mutationFn: () => saveCampusSettings(agencyId, draft),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["campus-settings", agencyId] });
      setDraft({});
      setIsDirty(false);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-rose-400">
        Failed to load settings. Check your connection and refresh.
      </p>
    );
  }

  const joinEmails = (arr: string[]) => arr.join(", ");
  const splitEmails = (s: string) =>
    s
      .split(/[,\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);

  return (
    <div className="text-white">
      <div className="mb-10">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-500">
          Campus Safety — {campusCode.toUpperCase()}
        </p>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
      </div>

      <div className="mx-auto max-w-3xl space-y-10 pb-16">
        <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-6">
          <SectionHeader
            icon={Settings}
            title="General"
            description="Campus identity and regional settings."
          />
          <div className="space-y-5">
            <Field label="Display name" hint="Shown in the console header and reports.">
              <TextInput
                value={merged.general.displayName}
                onChange={(v) => update("general", { displayName: v })}
                placeholder="e.g. Columbus State University Safety"
              />
            </Field>
            <Field label="Campus type">
              <div className="relative">
                <select
                  value={merged.general.campusType}
                  onChange={(e) =>
                    update("general", {
                      campusType: e.target.value as CampusSettingsView["general"]["campusType"],
                    })
                  }
                  className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
                >
                  <option value="university">University / College</option>
                  <option value="k12">K–12 School</option>
                  <option value="community_college">Community College</option>
                  <option value="corporate">Corporate Campus</option>
                  <option value="other">Other</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
              </div>
            </Field>
            <Field label="Timezone">
              <div className="relative">
                <select
                  value={merged.general.timezone}
                  onChange={(e) => update("general", { timezone: e.target.value })}
                  className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
                >
                  <option value="America/New_York">Eastern (ET)</option>
                  <option value="America/Chicago">Central (CT)</option>
                  <option value="America/Denver">Mountain (MT)</option>
                  <option value="America/Los_Angeles">Pacific (PT)</option>
                  <option value="America/Anchorage">Alaska (AKT)</option>
                  <option value="Pacific/Honolulu">Hawaii (HT)</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-slate-500" />
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-6">
          <SectionHeader
            icon={Bell}
            title="Notifications"
            description="Who receives alerts when incidents are created or escalated."
          />
          <div className="space-y-5">
            <Field
              label="New incident — email"
              hint="Comma-separated email addresses. Notified when a new incident is reported."
            >
              <TextInput
                value={joinEmails(merged.notifications.newIncidentEmails)}
                onChange={(v) => update("notifications", { newIncidentEmails: splitEmails(v) })}
                placeholder="safety@university.edu, dispatch@university.edu"
              />
            </Field>
            <Field
              label="Escalation — email"
              hint="Notified when an incident is escalated or unacknowledged beyond the threshold."
            >
              <TextInput
                value={joinEmails(merged.notifications.escalationEmails)}
                onChange={(v) => update("notifications", { escalationEmails: splitEmails(v) })}
                placeholder="director@university.edu"
              />
            </Field>
            <Field label="New incident — SMS" hint="E.164 format (+15550001234). Carrier rates apply.">
              <TextInput
                value={joinEmails(merged.notifications.newIncidentSms)}
                onChange={(v) => update("notifications", { newIncidentSms: splitEmails(v) })}
                placeholder="+17065550001, +17065550002"
              />
            </Field>
            <Field label="Escalation — SMS">
              <TextInput
                value={joinEmails(merged.notifications.escalationSms)}
                onChange={(v) => update("notifications", { escalationSms: splitEmails(v) })}
                placeholder="+17065550003"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-6">
          <SectionHeader
            icon={AlertTriangle}
            title="Escalation"
            description="Automatically alert contacts if an incident goes unacknowledged."
          />
          <div className="space-y-5">
            <Toggle
              checked={merged.escalation.enabled}
              onChange={(v) => update("escalation", { enabled: v })}
              label="Enable auto-escalation"
            />
            {merged.escalation.enabled ? (
              <>
                <Field
                  label="Escalation threshold"
                  hint="Alert escalation contacts if an incident is not acknowledged within this window."
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={merged.escalation.thresholdMinutes}
                      onChange={(e) =>
                        update("escalation", { thresholdMinutes: Number(e.target.value) })
                      }
                      className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
                    />
                    <span className="text-sm text-slate-400">minutes</span>
                  </div>
                </Field>
                <Field label="Escalation contacts">
                  <div className="space-y-3">
                    {merged.escalation.escalationContacts.map((contact, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-3 gap-2 rounded-lg border border-slate-700/60 p-3"
                      >
                        <TextInput
                          value={contact.name}
                          onChange={(v) => {
                            const contacts = [...merged.escalation.escalationContacts];
                            contacts[i] = { ...contacts[i], name: v };
                            update("escalation", { escalationContacts: contacts });
                          }}
                          placeholder="Name"
                        />
                        <TextInput
                          value={contact.email}
                          onChange={(v) => {
                            const contacts = [...merged.escalation.escalationContacts];
                            contacts[i] = { ...contacts[i], email: v };
                            update("escalation", { escalationContacts: contacts });
                          }}
                          placeholder="Email"
                        />
                        <TextInput
                          value={contact.phone}
                          onChange={(v) => {
                            const contacts = [...merged.escalation.escalationContacts];
                            contacts[i] = { ...contacts[i], phone: v };
                            update("escalation", { escalationContacts: contacts });
                          }}
                          placeholder="+1 706 555 0001"
                        />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        update("escalation", {
                          escalationContacts: [
                            ...merged.escalation.escalationContacts,
                            { name: "", email: "", phone: "" },
                          ],
                        })
                      }
                      className="text-xs text-slate-400 underline underline-offset-2 hover:text-white"
                    >
                      + Add contact
                    </button>
                  </div>
                </Field>
              </>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-6">
          <SectionHeader
            icon={QrCode}
            title="Public Report Form"
            description="Shown when someone scans a campus QR code. This form is publicly accessible — do not collect sensitive data."
          />
          <div className="space-y-5">
            <Field label="Form title" hint="Displayed at the top of the public report form.">
              <TextInput
                value={merged.publicForm.title}
                onChange={(v) => update("publicForm", { title: v })}
                placeholder="Report a Safety Concern"
              />
            </Field>
            <Field label="Instructions" hint="Optional helper text shown under the title.">
              <Textarea
                value={merged.publicForm.instructions}
                onChange={(v) => update("publicForm", { instructions: v })}
                placeholder="Use this form to report a non-emergency safety concern to campus security."
              />
            </Field>
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Collect from reporter
              </p>
              <Toggle
                checked={merged.publicForm.collectName}
                onChange={(v) => update("publicForm", { collectName: v })}
                label="Name (optional field)"
              />
              <Toggle
                checked={merged.publicForm.collectPhone}
                onChange={(v) => update("publicForm", { collectPhone: v })}
                label="Phone number (optional field)"
              />
              <Toggle
                checked={merged.publicForm.collectLocation}
                onChange={(v) => update("publicForm", { collectLocation: v })}
                label="Location description (free text)"
              />
            </div>
            <Field
              label="Disclaimer text"
              hint='Required. Displayed at the bottom of every public form. Must include "not 911" language.'
            >
              <Textarea
                value={merged.publicForm.disclaimerText}
                onChange={(v) => update("publicForm", { disclaimerText: v })}
                placeholder="This form is not monitored 24/7 and is not a substitute for calling 911 in an emergency."
                rows={2}
              />
              {!merged.publicForm.disclaimerText.toLowerCase().includes("911") ? (
                <p className="mt-1.5 text-xs text-yellow-500">
                  Disclaimer must reference 911 for public safety compliance.
                </p>
              ) : null}
            </Field>
          </div>
        </section>
      </div>

      <SaveBar
        isDirty={isDirty}
        isPending={mutation.isPending}
        isSuccess={savedOk}
        onSave={() => mutation.mutate()}
      />
    </div>
  );
}
