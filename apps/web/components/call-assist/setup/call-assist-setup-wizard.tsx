"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  CALL_ASSIST_CAD_WIZARD_OPTIONS,
  DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS,
  DEFAULT_DISCLOSURE_BY_VERTICAL,
  cadWizardSelection,
  clampEmergencyThreshold,
  defaultRetentionForVertical,
  demoScenarioPresetsForVertical,
  presetTaxonomy,
  substituteAgencyShortName,
  transferDirectoryPreset,
  type CallAssistDemoScenarioConfig,
  type CallAssistExternalTransferEntry,
  type CallAssistTaxonomyVertical,
} from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { CallAssistChrome } from "@/components/call-assist/call-assist-chrome";
import { useCallAssistAgencyScope } from "@/contexts/agency-context";
import { isApiConfigured } from "@/lib/api";
import { canSetCallAssistVertical, canSetupCallAssist } from "@/lib/call-assist/access";
import { getCallAssistRuntimeConfig, patchCallAssistConfig } from "@/lib/call-assist/call-assist-api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import { isCallAssistEnabled } from "@/lib/runtime-flags";

const STEPS = [
  "Operational profile",
  "Agency details",
  "CAD provider",
  "Transfer directory",
  "Disclosure",
  "Retention",
  "Hours",
  "Thresholds",
  "Demo scenarios",
  "Review",
] as const;

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

type WizardState = {
  vertical: CallAssistTaxonomyVertical;
  agencyName: string;
  agencyShortName: string;
  timezone: string;
  cadOptionId: string;
  cadOtherLabel: string;
  directory: CallAssistExternalTransferEntry[];
  disclosureText: string;
  policyName: string;
  audioDays: number;
  transcriptDays: number;
  governingLaw: string;
  allDay: boolean;
  emergency: number;
  escalate: number;
  selfService: number;
  demos: CallAssistDemoScenarioConfig[];
};

function applyVerticalDefaults(vertical: CallAssistTaxonomyVertical, shortName: string): Partial<WizardState> {
  const ret = defaultRetentionForVertical(vertical);
  return {
    vertical,
    directory: transferDirectoryPreset(vertical),
    disclosureText: substituteAgencyShortName(DEFAULT_DISCLOSURE_BY_VERTICAL[vertical], shortName || "this agency"),
    policyName: ret.policyName,
    audioDays: ret.audioRetentionDays,
    transcriptDays: ret.transcriptRetentionDays,
    governingLaw: ret.governingLaw ?? "",
    allDay: vertical === "911",
    demos:
      vertical === "911"
        ? []
        : demoScenarioPresetsForVertical(vertical).map((s) => ({ ...s, utterances: [...s.utterances] })),
  };
}

export function CallAssistSetupWizard() {
  const { user } = useSession();
  const { requestAgencyId, agencyId, ready } = useCallAssistAgencyScope();
  const router = useRouter();
  const to = useJurisdictionLink();
  const qc = useQueryClient();
  const allowed = canSetupCallAssist(user?.role);
  const canSetVertical = canSetCallAssistVertical(user?.role);
  const enabled = Boolean(user && isApiConfigured() && isCallAssistEnabled() && allowed && ready);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<WizardState>({
    vertical: "911",
    agencyName: "",
    agencyShortName: "",
    timezone: "America/Chicago",
    cadOptionId: "none",
    cadOtherLabel: "",
    directory: transferDirectoryPreset("911"),
    disclosureText: DEFAULT_DISCLOSURE_BY_VERTICAL["911"],
    policyName: "",
    audioDays: 90,
    transcriptDays: 365,
    governingLaw: "",
    allDay: true,
    emergency: DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS.emergency,
    escalate: DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS.escalate,
    selfService: DEFAULT_CALL_ASSIST_CONFIDENCE_THRESHOLDS.selfService,
    demos: [],
  });

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(false);
  }, [agencyId]);

  useEffect(() => {
    if (!canSetVertical && step === 0) setStep(1);
  }, [canSetVertical, step]);
  const configQuery = useQuery({
    queryKey: ["call-assist-runtime-config", agencyId],
    queryFn: () => getCallAssistRuntimeConfig(requestAgencyId),
    enabled,
  });

  if (configQuery.data && !hydrated) {
    const cfg = configQuery.data.config as Record<string, unknown>;
    const vertical = (cfg.vertical === "campus" || cfg.vertical === "venue" || cfg.vertical === "911"
      ? cfg.vertical
      : "911") as CallAssistTaxonomyVertical;
    const cadSel = cadWizardSelection(
      typeof cfg.cadProviderId === "string" ? cfg.cadProviderId : "mock",
      (cfg.cadProviderLabel as string | null | undefined) ?? null,
    );
    const ret = (cfg.retention ?? {}) as Record<string, unknown>;
    const hours = (cfg.operatingHours ?? {}) as Record<string, unknown>;
    const thresh = (cfg.confidenceThresholds ?? {}) as Record<string, number>;
    setHydrated(true);
    setState((s) => ({
      ...s,
      vertical,
      agencyName: String(cfg.agencyName ?? s.agencyName),
      agencyShortName: String(cfg.agencyShortName ?? cfg.shortName ?? s.agencyShortName),
      timezone: String(hours.timezone ?? s.timezone),
      cadOptionId: cadSel.id,
      cadOtherLabel: cadSel.id === "other" ? String(cadSel.cadProviderLabel ?? "") : "",
      disclosureText: String(cfg.disclosureText ?? s.disclosureText),
      policyName: String(ret.policyName ?? ret.displayName ?? s.policyName),
      audioDays: Number(ret.audioRetentionDays ?? s.audioDays),
      transcriptDays: Number(ret.transcriptRetentionDays ?? s.transcriptDays),
      governingLaw: String(ret.governingLaw ?? s.governingLaw ?? ""),
      allDay: hours.allDay === true || (Number(hours.openMinutes) === 0 && Number(hours.closeMinutes) === 24 * 60),
      emergency: Number(thresh.emergency ?? s.emergency),
      escalate: Number(thresh.escalate ?? s.escalate),
      selfService: Number(thresh.selfService ?? s.selfService),
      demos: Array.isArray(cfg.demoScenarios) ? (cfg.demoScenarios as CallAssistDemoScenarioConfig[]) : s.demos,
    }));
  }

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchCallAssistConfig(body, requestAgencyId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["call-assist-ui-profile"] });
      void qc.invalidateQueries({ queryKey: ["call-assist-runtime-config"] });
      void qc.invalidateQueries({ queryKey: ["call-assist-config"] });
    },
  });

  if (!user) return null;
  if (!allowed) {
    return <p className="p-6 text-sm text-rose-300">Only agency or platform administrators can configure Call Assist.</p>;
  }

  const cad = CALL_ASSIST_CAD_WIZARD_OPTIONS.find((o) => o.id === state.cadOptionId) ?? CALL_ASSIST_CAD_WIZARD_OPTIONS[6];
  const cadLabel = state.cadOptionId === "other" ? state.cadOtherLabel.trim() || "CAD" : cad.cadProviderLabel;
  const taxonomyPreview = presetTaxonomy(state.vertical);

  async function persistStep(nextStep: number) {
    setError(null);
    const payloads: Record<string, unknown>[] = [
      { vertical: state.vertical, uiVertical: state.vertical },
      {
        agencyName: state.agencyName.trim(),
        agencyShortName: state.agencyShortName.trim(),
        shortName: state.agencyShortName.trim(),
        operatingHours: { timezone: state.timezone },
      },
      {
        cadProviderId: cad.cadProviderId,
        cadProviderLabel: state.cadOptionId === "none" ? null : cadLabel,
      },
      { externalTransferList: state.directory },
      { disclosureText: state.disclosureText.trim() },
      {
        retention: {
          policyName: state.policyName.trim(),
          displayName: state.policyName.trim() || undefined,
          audioRetentionDays: state.audioDays,
          transcriptRetentionDays: state.transcriptDays,
          governingLaw: state.governingLaw.trim() || null,
        },
      },
      {
        operatingHours: {
          timezone: state.timezone,
          allDay: state.allDay,
          openMinutes: 0,
          closeMinutes: 24 * 60,
        },
      },
      {
        confidenceThresholds: {
          emergency: clampEmergencyThreshold(state.emergency),
          escalate: state.escalate,
          selfService: state.selfService,
        },
      },
      { demoScenarios: state.demos },
      { onboardingComplete: true, onboardingCompletedAt: new Date().toISOString() },
    ];
    try {
      if (step === 0) {
        if (!canSetVertical) {
          setStep(1);
          return;
        }
        if (!state.vertical) throw new Error("Select an operational profile");
      }
      if (step === 1 && (!state.agencyName.trim() || !state.agencyShortName.trim())) {
        throw new Error("Agency name and short name are required");
      }
      await save.mutateAsync(payloads[step] ?? {});
      if (step === 9) {
        router.replace(to("/call-assist"));
        return;
      }
      setStep(nextStep);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  return (
    <div className="p-4 md:p-6">
      <CallAssistChrome title="Call Assist setup" />
      <p className="mb-4 max-w-2xl text-[12px] text-slate-500">
        Configure this agency only. Emergency transfer cannot be disabled. CAD write-back stays off.
      </p>
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <ol className="space-y-1 text-[12px]">
          {STEPS.map((label, i) => {
            if (i === 0 && !canSetVertical) return null;
            return (
            <li key={label}>
              <button
                type="button"
                className={`w-full rounded px-2 py-1.5 text-left ${
                  i === step ? "bg-sky-500/15 text-sky-300" : i < step ? "text-slate-300" : "text-slate-500"
                }`}
                onClick={() => i < step && setStep(i)}
              >
                {label}
              </button>
            </li>
            );
          })}
        </ol>
        <div className="rounded-lg border border-slate-800 p-4">
          {step === 0 && canSetVertical ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white">Operational profile</h2>
              <p className="text-[12px] text-slate-500">
                Internal Rapid Cortex configuration. This screen is never shown to the agency.
              </p>
              {(["911", "campus", "venue"] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    checked={state.vertical === v}
                    onChange={() =>
                      setState((s) => ({ ...s, ...applyVerticalDefaults(v, s.agencyShortName), vertical: v }))
                    }
                  />
                  {v === "911" ? "911" : v === "campus" ? "Campus" : "Venue"}
                </label>
              ))}
              <p className="text-[11px] text-slate-500">
                {taxonomyPreview.callTypes.length} classification types · default intake {taxonomyPreview.defaultIntakeTemplateId}
              </p>
            </div>
          ) : null}
          {step === 1 ? (
            <div className="grid max-w-lg gap-3">
              <h2 className="text-sm font-semibold text-white">Agency details</h2>
              <input
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                placeholder="Agency full name"
                value={state.agencyName}
                onChange={(e) => setState((s) => ({ ...s, agencyName: e.target.value }))}
              />
              <input
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                placeholder="Short name (max 20)"
                maxLength={20}
                value={state.agencyShortName}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    agencyShortName: e.target.value,
                    disclosureText: substituteAgencyShortName(DEFAULT_DISCLOSURE_BY_VERTICAL[s.vertical], e.target.value),
                  }))
                }
              />
              <select
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                value={state.timezone}
                onChange={(e) => setState((s) => ({ ...s, timezone: e.target.value }))}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {step === 2 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-white">Does this agency use a CAD system?</h2>
              <p className="text-[11px] text-amber-300/80">Selecting a provider does not enable CAD write-back.</p>
              {CALL_ASSIST_CAD_WIZARD_OPTIONS.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    checked={state.cadOptionId === opt.id}
                    onChange={() => setState((s) => ({ ...s, cadOptionId: opt.id }))}
                  />
                  {opt.label}
                </label>
              ))}
              {state.cadOptionId === "other" ? (
                <input
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                  placeholder="CAD product name"
                  value={state.cadOtherLabel}
                  onChange={(e) => setState((s) => ({ ...s, cadOtherLabel: e.target.value }))}
                />
              ) : null}
            </div>
          ) : null}
          {step === 3 ? (
            <DirectoryEditor directory={state.directory} onChange={(directory) => setState((s) => ({ ...s, directory }))} />
          ) : null}
          {step === 4 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-white">Disclosure text</h2>
              <textarea
                className="h-28 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                maxLength={500}
                value={state.disclosureText}
                onChange={(e) => setState((s) => ({ ...s, disclosureText: e.target.value }))}
              />
              <p className="text-[11px] text-slate-500">{state.disclosureText.length}/500</p>
              <p className="text-[11px] text-slate-500">
                Disclosure requirements vary by state. Confirm with your legal counsel.
              </p>
            </div>
          ) : null}
          {step === 5 ? (
            <div className="grid max-w-lg gap-3">
              <h2 className="text-sm font-semibold text-white">Retention policy</h2>
              <input
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                placeholder="Policy name"
                value={state.policyName}
                onChange={(e) => setState((s) => ({ ...s, policyName: e.target.value }))}
              />
              <label className="text-[12px] text-slate-400">
                Audio days
                <input
                  type="number"
                  className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  value={state.audioDays}
                  min={1}
                  max={3650}
                  onChange={(e) => setState((s) => ({ ...s, audioDays: Number(e.target.value) }))}
                />
              </label>
              <label className="text-[12px] text-slate-400">
                Transcript days
                <input
                  type="number"
                  className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                  value={state.transcriptDays}
                  min={1}
                  max={3650}
                  onChange={(e) => setState((s) => ({ ...s, transcriptDays: Number(e.target.value) }))}
                />
              </label>
              <textarea
                className="h-20 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                placeholder="Governing law (shown on Records)"
                value={state.governingLaw}
                onChange={(e) => setState((s) => ({ ...s, governingLaw: e.target.value }))}
              />
            </div>
          ) : null}
          {step === 6 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-white">Operating hours</h2>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input type="checkbox" checked={state.allDay} onChange={(e) => setState((s) => ({ ...s, allDay: e.target.checked }))} />
                24 hours / 7 days
              </label>
              <p className="text-[11px] text-slate-500">
                Outside hours the assistant discloses that the office is closed. Per-day windows can be refined in admin.
              </p>
            </div>
          ) : null}
          {step === 7 ? (
            <div className="max-w-lg space-y-4">
              <h2 className="text-sm font-semibold text-white">Confidence thresholds</h2>
              <p className="text-[12px] text-slate-500">
                These thresholds control how often the AI transfers to a human. Lower emergency threshold = more
                transfers. Start with defaults. The Safety Engine emergency path cannot be turned off.
              </p>
              <Slider label="Emergency" value={state.emergency} min={0.5} max={0.9} onChange={(emergency) => setState((s) => ({ ...s, emergency }))} />
              <Slider label="Escalation" value={state.escalate} min={0.4} max={0.8} onChange={(escalate) => setState((s) => ({ ...s, escalate }))} />
              <Slider label="Self-service" value={state.selfService} min={0.6} max={0.95} onChange={(selfService) => setState((s) => ({ ...s, selfService }))} />
            </div>
          ) : null}
          {step === 8 ? (
            <DemoEditor vertical={state.vertical} demos={state.demos} onChange={(demos) => setState((s) => ({ ...s, demos }))} />
          ) : null}
          {step === 9 ? (
            <div className="space-y-2 text-sm text-slate-300">
              <h2 className="text-sm font-semibold text-white">Review + activate</h2>
              {canSetVertical ? <p>Operational profile: {state.vertical === "911" ? "911" : state.vertical === "campus" ? "Campus" : "Venue"}</p> : null}
              <p>
                Agency: {state.agencyName} ({state.agencyShortName}) · {state.timezone}
              </p>
              <p>CAD: {cadLabel ?? "None — CAD push hidden"}</p>
              <p>Transfers: {state.directory.length} directory entries</p>
              <p>Retention: {state.governingLaw || state.policyName || "Agency retention policy"}</p>
              <p>
                Thresholds: emergency {state.emergency.toFixed(2)} · escalate {state.escalate.toFixed(2)}
              </p>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-[12px] text-rose-300">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            {step > (canSetVertical ? 0 : 1) ? (
              <button type="button" className="rounded border border-slate-700 px-3 py-1.5 text-[12px] text-slate-300" onClick={() => setStep(step - 1)}>
                Back
              </button>
            ) : null}
            {step < 9 && step > 0 ? (
              <button
                type="button"
                className="rounded border border-slate-700 px-3 py-1.5 text-[12px] text-slate-400"
                onClick={() => void persistStep(step + 1)}
              >
                Skip
              </button>
            ) : null}
            <button
              type="button"
              className="rounded bg-sky-700 px-3 py-1.5 text-[12px] text-white disabled:opacity-50"
              disabled={save.isPending}
              onClick={() => void persistStep(step === 9 ? 9 : step + 1)}
            >
              {step === 9 ? "Activate Call Assist" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block text-[12px] text-slate-400">
      {label} {value.toFixed(2)}
      <input
        type="range"
        className="mt-1 w-full"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function DirectoryEditor({
  directory,
  onChange,
}: {
  directory: CallAssistExternalTransferEntry[];
  onChange: (rows: CallAssistExternalTransferEntry[]) => void;
}) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-white">Transfer directory</h2>
      {directory.map((row, i) => (
        <div key={row.id} className="grid gap-2 rounded border border-slate-800 p-2 sm:grid-cols-3">
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
            value={row.name}
            onChange={(e) => {
              const next = [...directory];
              next[i] = { ...row, name: e.target.value };
              onChange(next);
            }}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
            value={row.number}
            onChange={(e) => {
              const next = [...directory];
              next[i] = { ...row, number: e.target.value };
              onChange(next);
            }}
          />
          <button type="button" className="text-[11px] text-rose-300" onClick={() => onChange(directory.filter((d) => d.id !== row.id))}>
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-[12px] text-sky-400"
        onClick={() =>
          onChange([
            ...directory,
            { id: `ext-${directory.length + 1}`, name: "", number: "", warmTransferScript: null },
          ])
        }
      >
        Add entry
      </button>
    </div>
  );
}

function DemoEditor({
  vertical,
  demos,
  onChange,
}: {
  vertical: CallAssistTaxonomyVertical;
  demos: CallAssistDemoScenarioConfig[];
  onChange: (rows: CallAssistDemoScenarioConfig[]) => void;
}) {
  const presets = vertical === "911" ? [] : demoScenarioPresetsForVertical(vertical);
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-white">Demo scenarios</h2>
      <p className="text-[12px] text-slate-500">
        {vertical === "911"
          ? "Municipal agencies keep the existing evaluation library unless you add custom scenarios here."
          : "Uncheck presets you do not want in the demo runner."}
      </p>
      {presets.map((p) => {
        const on = demos.some((d) => d.id === p.id);
        return (
          <label key={p.id} className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => {
                if (e.target.checked) onChange([...demos, { ...p, utterances: [...p.utterances] }]);
                else onChange(demos.filter((d) => d.id !== p.id));
              }}
            />
            {p.label}
          </label>
        );
      })}
    </div>
  );
}
