"use client";

import type { ReactNode } from "react";
import type { CampusInfoTab, CampusSite } from "rapid-cortex-shared";
import { FileText, Plus, Trash2 } from "lucide-react";

type Props = {
  sites: CampusSite[];
  editingSiteCode: string;
  onEditingSiteCodeChange: (code: string) => void;
  value: CampusInfoTab;
  onChange: (next: CampusInfoTab) => void;
};

const EMPTY: CampusInfoTab = {
  displayName: "",
  logoUrl: "",
  emergencyContacts: [],
  sections: [],
  externalLinks: [],
};

export function CampusInfoTabEditor({
  sites,
  editingSiteCode,
  onEditingSiteCodeChange,
  value,
  onChange,
}: Props) {
  const tab = {
    ...EMPTY,
    ...value,
    emergencyContacts: value.emergencyContacts ?? [],
    sections: value.sections ?? [],
    externalLinks: value.externalLinks ?? [],
  };

  return (
    <section className="rounded-xl border border-slate-700/60 bg-slate-900 p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800">
          <FileText className="h-4 w-4 text-slate-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Public information tab</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Shown after someone scans a campus QR or NFC code. Updates go live immediately — no
            reprint needed.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {sites.length > 0 ? (
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Campus site
            </label>
            <select
              value={editingSiteCode}
              onChange={(e) => onEditingSiteCodeChange(e.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-slate-500 focus:outline-none"
            >
              <option value="">Tenant default (all sites)</option>
              {sites.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Site-specific tabs override the tenant default for QR codes tagged with that site.
            </p>
          </div>
        ) : null}

        <Field label="Display name">
          <input
            className={inputClass}
            value={tab.displayName ?? ""}
            onChange={(e) => onChange({ ...tab, displayName: e.target.value })}
            placeholder="e.g. Riverside Community College"
          />
        </Field>
        <Field label="Logo URL" hint="HTTPS URL only. Leave blank to use the default header.">
          <input
            className={inputClass}
            value={tab.logoUrl ?? ""}
            onChange={(e) => onChange({ ...tab, logoUrl: e.target.value })}
            placeholder="https://cdn.example.edu/logo.png"
          />
        </Field>
        <Field label="Brand color" hint="Hex color for accents on the public Information tab.">
          <input
            className={inputClass}
            value={tab.brandColor ?? ""}
            onChange={(e) => onChange({ ...tab, brandColor: e.target.value || undefined })}
            placeholder="#0F766E"
          />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Emergency contacts
            </p>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              onClick={() =>
                onChange({
                  ...tab,
                  emergencyContacts: [...(tab.emergencyContacts ?? []), { label: "", phone: "" }],
                })
              }
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {(tab.emergencyContacts ?? []).map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Campus Police"
                  value={c.label}
                  onChange={(e) => {
                    const next = [...(tab.emergencyContacts ?? [])];
                    next[i] = { ...next[i]!, label: e.target.value };
                    onChange({ ...tab, emergencyContacts: next });
                  }}
                />
                <input
                  className={inputClass}
                  placeholder="901-555-0100"
                  value={c.phone}
                  onChange={(e) => {
                    const next = [...(tab.emergencyContacts ?? [])];
                    next[i] = { ...next[i]!, phone: e.target.value };
                    onChange({ ...tab, emergencyContacts: next });
                  }}
                />
                <button
                  type="button"
                  className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-rose-300"
                  onClick={() =>
                    onChange({
                      ...tab,
                      emergencyContacts: (tab.emergencyContacts ?? []).filter((_, j) => j !== i),
                    })
                  }
                  aria-label="Remove contact"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Sections (markdown)
            </p>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              onClick={() =>
                onChange({
                  ...tab,
                  sections: [
                    ...(tab.sections ?? []),
                    {
                      title: "",
                      content: "",
                      order: (tab.sections ?? []).length,
                      visible: true,
                    },
                  ],
                })
              }
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="space-y-3">
            {(tab.sections ?? []).map((s, i) => (
              <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                <div className="mb-2 flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Section title"
                    value={s.title}
                    onChange={(e) => {
                      const next = [...(tab.sections ?? [])];
                      next[i] = { ...next[i]!, title: e.target.value };
                      onChange({ ...tab, sections: next });
                    }}
                  />
                  <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={s.visible !== false}
                      onChange={(e) => {
                        const next = [...(tab.sections ?? [])];
                        next[i] = { ...next[i]!, visible: e.target.checked };
                        onChange({ ...tab, sections: next });
                      }}
                    />
                    Visible
                  </label>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-rose-300"
                    onClick={() =>
                      onChange({
                        ...tab,
                        sections: (tab.sections ?? []).filter((_, j) => j !== i),
                      })
                    }
                    aria-label="Remove section"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  className={`${inputClass} min-h-[80px] resize-y`}
                  placeholder="Markdown content — e.g. evacuation steps, AED locations…"
                  value={s.content}
                  onChange={(e) => {
                    const next = [...(tab.sections ?? [])];
                    next[i] = { ...next[i]!, content: e.target.value };
                    onChange({ ...tab, sections: next });
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Alert banner
          </p>
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={Boolean(tab.alertBanner?.active)}
              onChange={(e) =>
                onChange({
                  ...tab,
                  alertBanner: {
                    message: tab.alertBanner?.message ?? "",
                    severity: tab.alertBanner?.severity ?? "warning",
                    active: e.target.checked,
                  },
                })
              }
            />
            Show active banner on the public Information tab
          </label>
          <input
            className={`${inputClass} mb-2`}
            placeholder="Active lockdown notice, weather alert…"
            value={tab.alertBanner?.message ?? ""}
            onChange={(e) =>
              onChange({
                ...tab,
                alertBanner: {
                  message: e.target.value,
                  severity: tab.alertBanner?.severity ?? "warning",
                  active: Boolean(tab.alertBanner?.active),
                },
              })
            }
          />
          <select
            className={inputClass}
            value={tab.alertBanner?.severity ?? "warning"}
            onChange={(e) =>
              onChange({
                ...tab,
                alertBanner: {
                  message: tab.alertBanner?.message ?? "",
                  severity: e.target.value as "info" | "warning" | "critical",
                  active: Boolean(tab.alertBanner?.active),
                },
              })
            }
          >
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              External links
            </p>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
              onClick={() =>
                onChange({
                  ...tab,
                  externalLinks: [...(tab.externalLinks ?? []), { label: "", url: "https://" }],
                })
              }
            >
              <Plus className="h-3 w-3" /> Add
            </button>
          </div>
          <div className="space-y-2">
            {(tab.externalLinks ?? []).map((l, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Campus emergency page"
                  value={l.label}
                  onChange={(e) => {
                    const next = [...(tab.externalLinks ?? [])];
                    next[i] = { ...next[i]!, label: e.target.value };
                    onChange({ ...tab, externalLinks: next });
                  }}
                />
                <input
                  className={inputClass}
                  placeholder="https://…"
                  value={l.url}
                  onChange={(e) => {
                    const next = [...(tab.externalLinks ?? [])];
                    next[i] = { ...next[i]!, url: e.target.value };
                    onChange({ ...tab, externalLinks: next });
                  }}
                />
                <button
                  type="button"
                  className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-rose-300"
                  onClick={() =>
                    onChange({
                      ...tab,
                      externalLinks: (tab.externalLinks ?? []).filter((_, j) => j !== i),
                    })
                  }
                  aria-label="Remove link"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
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

const inputClass =
  "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500";
