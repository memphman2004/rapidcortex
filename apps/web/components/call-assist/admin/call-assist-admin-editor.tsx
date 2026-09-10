"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CALL_ASSIST_CAD_WIZARD_OPTIONS,
  cadWizardSelection,
  clampEmergencyThreshold,
  demoScenarioPresetsForVertical,
  resolveAgencyTaxonomy,
  type AgencyTaxonomy,
  type CallAssistDemoScenarioConfig,
  type CallAssistExternalTransferEntry,
  type CallAssistTaxonomyVertical,
  type CallType,
} from "rapid-cortex-shared";
import { useSession } from "@/components/auth/session-context";
import { CallAssistChrome } from "@/components/call-assist/call-assist-chrome";
import { useCallAssistConfig } from "@/contexts/call-assist-config-context";
import { isApiConfigured } from "@/lib/api";
import { canAdminCallAssist, canManageCallAssistPrompts } from "@/lib/call-assist/access";
import {
  getCallAssistConfig,
  getCallAssistExternalAgencies,
  patchCallAssistConfig,
  listCallAssistKnowledge,
  upsertCallAssistKnowledge,
  deleteCallAssistKnowledge,
  type CallAssistKnowledgeArticleDto,
} from "@/lib/call-assist/call-assist-api";
import { useJurisdictionLink } from "@/lib/jurisdiction-context";
import Link from "next/link";
import { isCallAssistEnabled, isCallAssistGreetingConfigEnabled } from "@/lib/runtime-flags";
import { CallAssistPromptCms } from "./call-assist-prompt-cms";
import { CallAssistGreetingEditor } from "./call-assist-greeting-editor";

type Tab = "settings" | "greeting" | "types" | "knowledge" | "demos" | "prompts";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type HoursDay = { day: number; closed: boolean; openMinutes: number; closeMinutes: number };

function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function timeToMinutes(value: string): number {
  const [h, m] = value.split(":").map((n) => Number(n));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return Math.max(0, Math.min(24 * 60, h * 60 + m));
}

function slugCallTypeId(label: string, used: Set<string>): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]/, "t$&");
  let id = base || "custom_type";
  let n = 2;
  while (used.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  return id;
}

export function CallAssistAdminEditor() {
  const { user } = useSession();
  const { requestAgencyId, agencyId, ready, runtime, refresh } = useCallAssistConfig();
  const to = useJurisdictionLink();
  const allowed = canAdminCallAssist(user?.role);
  const canPrompts = canManageCallAssistPrompts(user?.role);
  const enabled = Boolean(user && isApiConfigured() && isCallAssistEnabled() && allowed && ready);
  const greetingEnabled = isCallAssistGreetingConfigEnabled();
  const [tab, setTab] = useState<Tab>("settings");
  const [msg, setMsg] = useState<string | null>(null);
  const [disclosure, setDisclosure] = useState<string | null>(null);
  const [shortName, setShortName] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [cadId, setCadId] = useState<string | null>(null);
  const [directory, setDirectory] = useState<CallAssistExternalTransferEntry[] | null>(null);
  const [emergency, setEmergency] = useState<number | null>(null);
  const [escalate, setEscalate] = useState<number | null>(null);
  const [selfService, setSelfService] = useState<number | null>(null);
  const [policyName, setPolicyName] = useState<string | null>(null);
  const [audioDays, setAudioDays] = useState<number | null>(null);
  const [transcriptDays, setTranscriptDays] = useState<number | null>(null);
  const [governingLaw, setGoverningLaw] = useState<string | null>(null);
  const [allDay, setAllDay] = useState<boolean | null>(null);
  const [hoursDays, setHoursDays] = useState<HoursDay[] | null>(null);
  const [tenantCity, setTenantCity] = useState<string | null>(null);
  const [tenantState, setTenantState] = useState<string | null>(null);
  const [gisZonesText, setGisZonesText] = useState<string | null>(null);
  const [callbackEnabled, setCallbackEnabled] = useState<boolean | null>(null);
  const [callbackMax, setCallbackMax] = useState<number | null>(null);
  const [callbackRetry, setCallbackRetry] = useState<number | null>(null);
  const [smsEnabled, setSmsEnabled] = useState<boolean | null>(null);

  const configQuery = useQuery({
    queryKey: ["call-assist-config", agencyId],
    queryFn: () => getCallAssistConfig(requestAgencyId),
    enabled,
  });
  const extQuery = useQuery({
    queryKey: ["call-assist-external", agencyId],
    queryFn: () => getCallAssistExternalAgencies(requestAgencyId),
    enabled,
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchCallAssistConfig(body, requestAgencyId),
    onSuccess: async () => {
      setMsg("Saved");
      await refresh();
    },
    onError: (err) => setMsg(err instanceof Error ? err.message : "Save failed"),
  });

  if (!user) return null;
  if (!allowed) {
    return <p className="p-6 text-sm text-rose-300">Call Assist admin is limited to agency administrators.</p>;
  }

  const config = (configQuery.data?.config ?? runtime?.config ?? {}) as Record<string, unknown>;
  const taxonomy =
    (runtime?.taxonomy as AgencyTaxonomy | undefined) ??
    resolveAgencyTaxonomy({
      taxonomy: config.taxonomy as AgencyTaxonomy | null,
      vertical: (config.vertical as string) ?? (config.uiVertical as string),
    });
  const cadSel = cadWizardSelection(
    String(config.cadProviderId ?? "mock"),
    (config.cadProviderLabel as string | null | undefined) ?? null,
  );
  const retention = (config.retention ?? {}) as Record<string, unknown>;
  const hours = (config.operatingHours ?? {}) as Record<string, unknown>;
  const thresh = (config.confidenceThresholds ?? {}) as Record<string, number>;
  const disclosureValue = disclosure ?? String(config.disclosureText ?? "");
  const mappedDirectory: CallAssistExternalTransferEntry[] =
    directory ??
    (extQuery.data?.items ?? []).map((row) => {
      const r = row as {
        externalAgencyId: string;
        externalAgencyName: string;
        phoneNumber: string;
        sipUri?: string;
        acceptedCallTypes?: string[];
        fallbackPhoneNumber?: string;
        afterHoursMessage?: string;
        callerExperienceScript?: string;
      };
      return {
        id: r.externalAgencyId,
        name: r.externalAgencyName,
        number: r.phoneNumber ?? "",
        sipUri: r.sipUri ?? null,
        acceptedCallTypes: r.acceptedCallTypes ?? [],
        fallbackNumber: r.fallbackPhoneNumber ?? null,
        afterHoursMessage: r.afterHoursMessage ?? null,
        warmTransferScript: r.callerExperienceScript ?? null,
      };
    });
  const hoursAllDay =
    allDay ?? (hours.allDay === true || (Number(hours.openMinutes) === 0 && Number(hours.closeMinutes) === 24 * 60));
  const dayRows =
    hoursDays ??
    DAY_LABELS.map((_, i) => {
      const existing = Array.isArray(hours.days)
        ? (hours.days as HoursDay[]).find((d) => d.day === i)
        : undefined;
      return (
        existing ?? {
          day: i,
          closed: false,
          openMinutes: Number(hours.openMinutes ?? 0),
          closeMinutes: Number(hours.closeMinutes ?? 24 * 60),
        }
      );
    });

  return (
    <div key={agencyId ?? "none"} className="space-y-4 p-4 md:p-6">
      <CallAssistChrome title="Call Assist admin" />
      <p className="max-w-2xl text-sm text-slate-400">
        Tenant configuration only. Safety Engine emergency transfer cannot be disabled. CAD write-back stays off.
      </p>
      <div className="flex flex-wrap gap-3 text-[12px]">
        <Link className="text-sky-400 hover:underline" href={to("/call-assist/setup?reconfigure=1")}>
          Reconfigure Call Assist
        </Link>
      </div>
      <div className="flex gap-2 text-[12px]">
        {(
          (greetingEnabled
            ? ["settings", "greeting", "types", "knowledge", "demos", "prompts"]
            : ["settings", "types", "knowledge", "demos", "prompts"]) as Tab[]
        ).map((t) => (
          <button
            key={t}
            type="button"
            className={`rounded px-2 py-1 ${tab === t ? "bg-sky-500/15 text-sky-300" : "text-slate-400"}`}
            onClick={() => setTab(t)}
          >
            {t === "settings"
              ? "Settings"
              : t === "greeting"
                ? "Greeting"
                : t === "types"
                  ? "Call types"
                  : t === "knowledge"
                    ? "Knowledge"
                    : t === "demos"
                      ? "Demo scenarios"
                      : "Prompts"}
          </button>
        ))}
      </div>
      {msg ? <p className="text-[12px] text-emerald-400">{msg}</p> : null}

      {tab === "settings" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-white">Agency info</h2>
            <input
              className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              defaultValue={String(config.agencyName ?? "")}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Agency name"
            />
            <input
              className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              defaultValue={String(config.agencyShortName ?? config.shortName ?? "")}
              maxLength={20}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Short name"
            />
            <button
              type="button"
              className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white"
              onClick={() =>
                save.mutate({
                  agencyName: agencyName ?? config.agencyName,
                  agencyShortName: shortName ?? config.agencyShortName ?? config.shortName,
                })
              }
            >
              Save
            </button>
          </section>
          <section className="rounded-lg border border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-white">CAD provider</h2>
            <select
              className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              defaultValue={cadSel.id}
              onChange={(e) => setCadId(e.target.value)}
            >
              {CALL_ASSIST_CAD_WIZARD_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-slate-500">
              Selecting a provider does not enable write-back. Write-back is configured separately and requires a
              signed addendum.
            </p>
            <button
              type="button"
              className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white"
              onClick={() => {
                const id = cadId ?? cadSel.id;
                const opt = CALL_ASSIST_CAD_WIZARD_OPTIONS.find((o) => o.id === id) ?? cadSel;
                save.mutate({
                  cadProviderId: opt.cadProviderId,
                  cadProviderLabel: opt.id === "none" ? null : opt.cadProviderLabel,
                });
              }}
            >
              Save
            </button>
          </section>
          <section className="rounded-lg border border-slate-800 p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Disclosure text</h2>
            <textarea
              className="mt-2 h-24 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              maxLength={500}
              value={disclosureValue}
              onChange={(e) => setDisclosure(e.target.value.slice(0, 500))}
            />
            <p className="mt-1 text-[11px] text-slate-500">{disclosureValue.length}/500</p>
            <p className="text-[11px] text-slate-500">
              Disclosure requirements vary by state. Confirm with your legal counsel.
            </p>
            <button
              type="button"
              className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white"
              onClick={() => save.mutate({ disclosureText: disclosureValue.trim() || config.disclosureText })}
            >
              Save
            </button>
          </section>
          <section className="rounded-lg border border-slate-800 p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Transfer directory</h2>
            <DirectoryEditor rows={mappedDirectory} onChange={setDirectory} />
            <button
              type="button"
              className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white"
              onClick={() =>
                save.mutate({
                  externalTransferList: mappedDirectory.filter(
                    (r) => r.name.trim() && (r.number.trim() || Boolean(r.sipUri?.trim())),
                  ),
                })
              }
            >
              Save directory
            </button>
          </section>
          <section className="rounded-lg border border-slate-800 p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Confidence thresholds</h2>
            <p className="mt-1 text-[12px] text-slate-500">
              Agency control plane. Below escalate, the AI auto-transfers to a person. Between escalate and
              self-service, intake continues with human review. Self-service is required to close without a
              person. Emergency is the floor to treat a taxonomy emergency match as 911.
            </p>
            <ThresholdSlider
              label="Emergency (911 match floor)"
              value={emergency ?? Number(thresh.emergency ?? 0.7)}
              min={0.5}
              max={0.9}
              onChange={setEmergency}
            />
            <ThresholdSlider
              label="Escalate to a person"
              value={escalate ?? Number(thresh.escalate ?? 0.55)}
              min={0.4}
              max={0.8}
              onChange={setEscalate}
            />
            <ThresholdSlider
              label="Self-service close"
              value={selfService ?? Number(thresh.selfService ?? 0.8)}
              min={0.6}
              max={0.95}
              onChange={setSelfService}
            />
            <button
              type="button"
              className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white"
              onClick={() =>
                save.mutate({
                  confidenceThresholds: {
                    emergency: clampEmergencyThreshold(emergency ?? Number(thresh.emergency ?? 0.7)),
                    escalate: escalate ?? Number(thresh.escalate ?? 0.55),
                    selfService: selfService ?? Number(thresh.selfService ?? 0.8),
                  },
                })
              }
            >
              Save thresholds
            </button>
          </section>
          <section className="rounded-lg border border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-white">Retention policy</h2>
            <input
              className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              defaultValue={String(retention.policyName ?? retention.displayName ?? "")}
              placeholder="Policy name"
              onChange={(e) => setPolicyName(e.target.value)}
            />
            <label className="mt-2 block text-[12px] text-slate-400">
              Audio days
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                defaultValue={Number(retention.audioRetentionDays ?? 90)}
                min={1}
                max={3650}
                onChange={(e) => setAudioDays(Number(e.target.value))}
              />
            </label>
            <label className="mt-2 block text-[12px] text-slate-400">
              Transcript days
              <input
                type="number"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                defaultValue={Number(retention.transcriptRetentionDays ?? 365)}
                min={1}
                max={3650}
                onChange={(e) => setTranscriptDays(Number(e.target.value))}
              />
            </label>
            <textarea
              className="mt-2 h-16 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
              defaultValue={String(retention.governingLaw ?? "")}
              placeholder="Governing law (shown on Records)"
              onChange={(e) => setGoverningLaw(e.target.value)}
            />
            <button
              type="button"
              className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white"
              onClick={() =>
                save.mutate({
                  retention: {
                    policyName: policyName ?? retention.policyName ?? retention.displayName,
                    displayName: policyName ?? retention.displayName ?? retention.policyName,
                    audioRetentionDays: audioDays ?? retention.audioRetentionDays,
                    transcriptRetentionDays: transcriptDays ?? retention.transcriptRetentionDays,
                    governingLaw: (governingLaw ?? retention.governingLaw ?? "") || null,
                  },
                })
              }
            >
              Save retention
            </button>
          </section>
          <section className="rounded-lg border border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-white">Callback campaign & SMS</h2>
            <p className="mt-1 text-[12px] text-slate-500">
              After-hours and overflow callbacks queue for the worker. Live PSTN outbound stays mock until Connect
              outbound is configured. SMS uses Twilio/SNS when those secrets are present; otherwise it mocks.
            </p>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={callbackEnabled ?? Boolean((config.callback as { enabled?: boolean } | undefined)?.enabled ?? true)}
                onChange={(e) => setCallbackEnabled(e.target.checked)}
              />
              Enable callback offers
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={smsEnabled ?? config.selfServiceSmsEnabled !== false}
                onChange={(e) => setSmsEnabled(e.target.checked)}
              />
              Enable SMS self-service links
            </label>
            <label className="mt-2 block text-[12px] text-slate-400">
              Max attempts
              <input
                type="number"
                min={1}
                max={10}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                value={callbackMax ?? Number((config.callback as { maxAttempts?: number } | undefined)?.maxAttempts ?? 3)}
                onChange={(e) => setCallbackMax(Number(e.target.value))}
              />
            </label>
            <label className="mt-2 block text-[12px] text-slate-400">
              Retry minutes
              <input
                type="number"
                min={1}
                max={240}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
                value={callbackRetry ?? Number((config.callback as { retryMinutes?: number } | undefined)?.retryMinutes ?? 15)}
                onChange={(e) => setCallbackRetry(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white"
              onClick={() =>
                save.mutate({
                  selfServiceSmsEnabled: smsEnabled ?? config.selfServiceSmsEnabled !== false,
                  callback: {
                    enabled: callbackEnabled ?? true,
                    maxAttempts: callbackMax ?? 3,
                    retryMinutes: callbackRetry ?? 15,
                    offerAfterHours: true,
                    offerOnOverflow: true,
                  },
                })
              }
            >
              Save callback / SMS
            </button>
          </section>
          <section className="rounded-lg border border-slate-800 p-4">
            <h2 className="text-sm font-semibold text-white">Operating hours</h2>
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={hoursAllDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              Always open
            </label>
            {!hoursAllDay ? (
              <div className="mt-2 space-y-1">
                {dayRows.map((row) => (
                  <div key={row.day} className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                    <span className="w-8">{DAY_LABELS[row.day]}</span>
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={row.closed}
                        onChange={(e) => {
                          const next = dayRows.map((d) =>
                            d.day === row.day ? { ...d, closed: e.target.checked } : d,
                          );
                          setHoursDays(next);
                        }}
                      />
                      Closed
                    </label>
                    <input
                      type="time"
                      disabled={row.closed}
                      value={minutesToTime(row.openMinutes)}
                      onChange={(e) => {
                        const next = dayRows.map((d) =>
                          d.day === row.day ? { ...d, openMinutes: timeToMinutes(e.target.value) } : d,
                        );
                        setHoursDays(next);
                      }}
                      className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5"
                    />
                    <input
                      type="time"
                      disabled={row.closed}
                      value={minutesToTime(row.closeMinutes)}
                      onChange={(e) => {
                        const next = dayRows.map((d) =>
                          d.day === row.day ? { ...d, closeMinutes: timeToMinutes(e.target.value) } : d,
                        );
                        setHoursDays(next);
                      }}
                      className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5"
                    />
                  </div>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white"
              onClick={() =>
                save.mutate({
                  operatingHours: {
                    timezone: String(hours.timezone ?? "America/Chicago"),
                    allDay: hoursAllDay,
                    openMinutes: 0,
                    closeMinutes: 24 * 60,
                    days: hoursAllDay ? undefined : dayRows,
                  },
                })
              }
            >
              Save hours
            </button>
          </section>
          <section className="rounded-lg border border-slate-800 p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Jurisdiction / GIS</h2>
            <p className="mt-1 text-[11px] text-slate-500">
              City and state hint PSAP polygon routing. Zones are GeoJSON-like rings of [lng, lat].
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                defaultValue={String(config.tenantCity ?? "")}
                onChange={(e) => setTenantCity(e.target.value)}
                placeholder="Tenant city"
              />
              <input
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
                defaultValue={String(config.tenantState ?? "")}
                onChange={(e) => setTenantState(e.target.value)}
                placeholder="Tenant state"
              />
            </div>
            <textarea
              className="mt-2 h-28 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[11px]"
              defaultValue={
                gisZonesText ??
                JSON.stringify((config.gisZones as unknown) ?? [], null, 2)
              }
              onChange={(e) => setGisZonesText(e.target.value)}
            />
            <button
              type="button"
              className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white"
              onClick={() => {
                try {
                  const parsed = JSON.parse(gisZonesText ?? JSON.stringify(config.gisZones ?? []));
                  save.mutate({
                    tenantCity: tenantCity ?? config.tenantCity,
                    tenantState: tenantState ?? config.tenantState,
                    gisZones: parsed,
                  });
                } catch {
                  setMsg("GIS zones must be valid JSON");
                }
              }}
            >
              Save GIS
            </button>
          </section>
        </div>
      ) : null}

      {tab === "greeting" && greetingEnabled ? (
        <CallAssistGreetingEditor
          config={config}
          pending={save.isPending}
          onSave={(callAssistGreeting) =>
            save.mutate({
              callAssistGreeting,
              agencyName: callAssistGreeting.agencyName,
              tenantCity: callAssistGreeting.cityName,
            })
          }
        />
      ) : null}

      {tab === "types" ? (
        <TaxonomyTable
          taxonomy={taxonomy}
          onSave={(next) => save.mutate({ taxonomy: next })}
          pending={save.isPending}
        />
      ) : null}

      {tab === "knowledge" ? (
        <KnowledgeAdmin agencyId={requestAgencyId} enabled={enabled} />
      ) : null}

      {tab === "demos" ? (
        <DemoScenariosEditor
          vertical={(taxonomy.vertical ?? "911") as CallAssistTaxonomyVertical}
          stored={(config.demoScenarios as CallAssistDemoScenarioConfig[] | undefined) ?? []}
          onSave={(demos) => save.mutate({ demoScenarios: demos })}
          pending={save.isPending}
        />
      ) : null}

      {tab === "prompts" ? (
        canPrompts ? (
          <CallAssistPromptCms />
        ) : (
          <p className="text-sm text-rose-300">Prompt CMS is limited to agency administrators.</p>
        )
      ) : null}
    </div>
  );
}

function ThresholdSlider({
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
    <label className="mt-3 block text-[12px] text-slate-400">
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
  rows,
  onChange,
}: {
  rows: CallAssistExternalTransferEntry[];
  onChange: (next: CallAssistExternalTransferEntry[]) => void;
}) {
  return (
    <div className="mt-2 space-y-2">
      {rows.map((row, i) => (
        <div key={row.id} className="grid gap-2 rounded border border-slate-800 p-2 md:grid-cols-3">
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
            value={row.name}
            placeholder="Name"
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, name: e.target.value };
              onChange(next);
            }}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-sm"
            value={row.number}
            placeholder="Number / extension"
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, number: e.target.value };
              onChange(next);
            }}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-sm"
            value={row.sipUri ?? ""}
            placeholder="SIP URI (optional)"
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, sipUri: e.target.value || null };
              onChange(next);
            }}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-sm md:col-span-2"
            value={(row.acceptedCallTypes ?? []).join(", ")}
            placeholder="Accepted call types (comma-separated)"
            onChange={(e) => {
              const next = [...rows];
              next[i] = {
                ...row,
                acceptedCallTypes: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              onChange(next);
            }}
          />
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1 font-mono text-sm"
            value={row.fallbackNumber ?? ""}
            placeholder="Fallback number"
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, fallbackNumber: e.target.value || null };
              onChange(next);
            }}
          />
          <button
            type="button"
            className="text-left text-[11px] text-rose-300"
            onClick={() => onChange(rows.filter((d) => d.id !== row.id))}
          >
            Remove
          </button>
          <textarea
            className="h-16 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm md:col-span-3"
            placeholder="Warm-transfer script (optional)"
            value={row.warmTransferScript ?? ""}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, warmTransferScript: e.target.value || null };
              onChange(next);
            }}
          />
          <textarea
            className="h-12 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm md:col-span-3"
            placeholder="After-hours message (used when hours are closed and policy is message)"
            value={row.afterHoursMessage ?? ""}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...row, afterHoursMessage: e.target.value || null };
              onChange(next);
            }}
          />
          <p className="text-[11px] italic text-slate-500 md:col-span-3">
            Runtime requires PSTN or SIP plus accepted call types. Transfer failure without a fallback number routes
            to a human call taker. Incomplete destinations never place a live SIP/PSTN transfer.
          </p>
        </div>
      ))}
      <button
        type="button"
        className="text-[12px] text-sky-400"
        onClick={() =>
          onChange([
            ...rows,
            {
              id: `ext-${Date.now()}`,
              name: "",
              number: "",
              sipUri: null,
              fallbackNumber: null,
              acceptedCallTypes: [],
              afterHoursMessage: null,
              warmTransferScript: null,
            },
          ])
        }
      >
        Add entry
      </button>
    </div>
  );
}

function TaxonomyTable({
  taxonomy,
  onSave,
  pending,
}: {
  taxonomy: AgencyTaxonomy;
  onSave: (next: AgencyTaxonomy) => void;
  pending: boolean;
}) {
  const [rows, setRows] = useState(taxonomy.callTypes);
  const [newLabel, setNewLabel] = useState("");
  useEffect(() => {
    setRows(taxonomy.callTypes);
  }, [taxonomy]);

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    const a = next[i];
    const b = next[j];
    next[i] = b;
    next[j] = a;
    setRows(next.map((row, idx) => ({ ...row, sortOrder: idx })));
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-left text-[12px]">
        <thead className="text-[10px] uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2">Label</th>
            <th className="px-3 py-2">Escalation</th>
            <th className="px-3 py-2">Priority</th>
            <th className="px-3 py-2">Enabled</th>
            <th className="px-3 py-2">Order</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className="border-t border-slate-800">
              <td className="px-3 py-2">
                {row.isEmergency ? (
                  <span title="Emergency types are managed by Rapid Cortex and cannot be disabled.">
                    🔒 {row.label}
                  </span>
                ) : (
                  <input
                    className="w-full bg-transparent"
                    value={row.label}
                    onChange={(e) => {
                      const next = [...rows];
                      next[i] = { ...row, label: e.target.value };
                      setRows(next);
                    }}
                  />
                )}
              </td>
              <td className="px-3 py-2">
                <select
                  className="bg-slate-950"
                  disabled={row.isEmergency}
                  value={row.escalationPath}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, escalationPath: e.target.value as CallType["escalationPath"] };
                    setRows(next);
                  }}
                >
                  <option value="emergency">emergency</option>
                  <option value="dispatcher">dispatcher</option>
                  <option value="external">external</option>
                  <option value="self_service">self_service</option>
                </select>
              </td>
              <td className="px-3 py-2">
                <select
                  className="bg-slate-950"
                  disabled={row.isEmergency}
                  value={row.defaultPriority}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = {
                      ...row,
                      defaultPriority: Number(e.target.value) as CallType["defaultPriority"],
                    };
                    setRows(next);
                  }}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={row.isEmergency}
                  onChange={(e) => {
                    const next = [...rows];
                    next[i] = { ...row, enabled: e.target.checked };
                    setRows(next);
                  }}
                />
              </td>
              <td className="px-3 py-2">
                <button type="button" className="mr-1 text-slate-400" onClick={() => move(i, -1)}>
                  ↑
                </button>
                <button type="button" className="text-slate-400" onClick={() => move(i, 1)}>
                  ↓
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="m-3 flex flex-wrap items-end gap-2">
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          placeholder="New call type label"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
        />
        <button
          type="button"
          className="text-[12px] text-sky-400"
          onClick={() => {
            const label = newLabel.trim();
            if (!label) return;
            const id = slugCallTypeId(label, new Set(rows.map((r) => r.id)));
            setRows([
              ...rows,
              {
                id,
                label,
                vertical: [taxonomy.vertical],
                cadNatureCode: null,
                defaultPriority: 3,
                escalationPath: "dispatcher",
                intakeTemplateId: taxonomy.defaultIntakeTemplateId,
                followUpQuestions: [],
                classifierKeywords: [],
                isEmergency: false,
                enabled: true,
                sortOrder: rows.length,
              },
            ]);
            setNewLabel("");
          }}
        >
          Add call type
        </button>
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1 text-[12px] text-white disabled:opacity-50"
          disabled={pending}
          onClick={() => onSave({ ...taxonomy, callTypes: rows.map((row, i) => ({ ...row, sortOrder: i })) })}
        >
          Save types
        </button>
      </div>
      <p className="mx-3 mb-3 text-[11px] text-slate-500">
        Emergency types are managed by Rapid Cortex and cannot be disabled.
      </p>
    </div>
  );
}

function DemoScenariosEditor({
  vertical,
  stored,
  onSave,
  pending,
}: {
  vertical: CallAssistTaxonomyVertical;
  stored: CallAssistDemoScenarioConfig[];
  onSave: (rows: CallAssistDemoScenarioConfig[]) => void;
  pending: boolean;
}) {
  const presets = useMemo(() => demoScenarioPresetsForVertical(vertical), [vertical]);
  const [rows, setRows] = useState<CallAssistDemoScenarioConfig[]>(() =>
    stored.length > 0 ? stored : presets.map((p) => ({ ...p, utterances: [...p.utterances] })),
  );
  const [label, setLabel] = useState("");
  const [utterances, setUtterances] = useState("");
  const [expectedClass, setExpectedClass] = useState("");

  useEffect(() => {
    setRows(stored.length > 0 ? stored : presets.map((p) => ({ ...p, utterances: [...p.utterances] })));
  }, [stored, presets]);

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 p-4">
      <p className="text-[12px] text-slate-500">
        Enable the scenarios this agency should see in the demo runner. Custom scenarios are tagged as custom.
      </p>
      {rows.map((row) => (
        <label key={row.id} className="flex items-start gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            className="mt-1"
            checked={row.enabled !== false}
            onChange={(e) =>
              setRows(rows.map((r) => (r.id === row.id ? { ...r, enabled: e.target.checked } : r)))
            }
          />
          <span>
            {row.label}
            <span className="ml-2 text-[10px] uppercase text-slate-500">{row.source}</span>
          </span>
        </label>
      ))}
      <div className="grid max-w-xl gap-2 border-t border-slate-800 pt-3">
        <p className="text-[12px] font-medium text-slate-300">Add scenario</p>
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <textarea
          className="h-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          placeholder="Utterances (one per line)"
          value={utterances}
          onChange={(e) => setUtterances(e.target.value)}
        />
        <input
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
          placeholder="Expected classification"
          value={expectedClass}
          onChange={(e) => setExpectedClass(e.target.value)}
        />
        <button
          type="button"
          className="w-fit text-[12px] text-sky-400"
          onClick={() => {
            const lines = utterances
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean);
            if (!label.trim() || lines.length === 0 || !expectedClass.trim()) return;
            setRows([
              ...rows,
              {
                id: `custom-${Date.now()}`,
                label: label.trim(),
                utterances: lines,
                expectedClass: expectedClass.trim(),
                vertical,
                source: "custom",
                enabled: true,
              },
            ]);
            setLabel("");
            setUtterances("");
            setExpectedClass("");
          }}
        >
          Add scenario
        </button>
      </div>
      <button
        type="button"
        className="rounded bg-sky-700 px-3 py-1 text-[12px] text-white disabled:opacity-50"
        disabled={pending}
        onClick={() => onSave(rows)}
      >
        Save scenarios
      </button>
    </div>
  );
}

function KnowledgeAdmin({ agencyId, enabled }: { agencyId?: string | null; enabled: boolean }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [source, setSource] = useState("");
  const [sourceType, setSourceType] = useState<"manual" | "url" | "policy" | "import">("manual");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [msg, setMsg] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["call-assist-knowledge", agencyId],
    queryFn: () => listCallAssistKnowledge(agencyId),
    enabled,
  });
  const save = useMutation({
    mutationFn: () =>
      upsertCallAssistKnowledge(
        {
          articleId: editingId,
          title,
          body,
          tags: [],
          enabled: true,
          source: source || undefined,
          sourceType,
        },
        agencyId,
      ),
    onSuccess: async () => {
      setMsg("Saved");
      setTitle("");
      setBody("");
      setSource("");
      setEditingId(undefined);
      await query.refetch();
    },
    onError: (err) => setMsg(err instanceof Error ? err.message : "Save failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteCallAssistKnowledge(id, agencyId),
    onSuccess: () => void query.refetch(),
  });
  const items = (query.data?.items ?? []) as CallAssistKnowledgeArticleDto[];

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-800 p-4">
        <h2 className="text-sm font-semibold text-white">{editingId ? "Edit article" : "New article"}</h2>
        <p className="mt-1 text-[11px] text-slate-500">
          Retrieval uses the current version only. Prior bodies stay on the article for audit.
        </p>
        <input
          className="mt-2 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <textarea
          className="mt-2 h-28 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Body"
        />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Source (URL, policy name, or note)"
          />
          <select
            className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value as typeof sourceType)}
          >
            <option value="manual">manual</option>
            <option value="url">url</option>
            <option value="policy">policy</option>
            <option value="import">import</option>
          </select>
        </div>
        <button
          type="button"
          className="mt-2 rounded bg-sky-700 px-3 py-1 text-[12px] text-white disabled:opacity-50"
          disabled={!title.trim() || !body.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {editingId ? "Save version" : "Create article"}
        </button>
        {msg ? <p className="mt-2 text-[12px] text-emerald-400">{msg}</p> : null}
      </section>
      <div className="overflow-hidden rounded-lg border border-slate-800">
        <table className="w-full text-left text-[12px]">
          <thead className="text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Version</th>
              <th className="px-3 py-2">Updated</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={5}>
                  {query.isLoading ? "Loading…" : "No knowledge articles yet."}
                </td>
              </tr>
            ) : (
              items.map((row) => (
                <tr key={row.articleId} className="border-t border-slate-800 align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-100">{row.title}</p>
                    <p className="mt-0.5 max-w-md text-[11px] text-slate-500">{row.body.slice(0, 140)}</p>
                    {row.previousBodies?.length ? (
                      <p className="mt-1 text-[10px] text-slate-600">
                        {row.previousBodies.length} prior version{row.previousBodies.length === 1 ? "" : "s"}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {row.sourceType ?? "manual"}
                    {row.source ? ` · ${row.source}` : ""}
                  </td>
                  <td className="px-3 py-2 font-mono text-slate-300">v{row.version ?? 1}</td>
                  <td className="px-3 py-2 text-slate-500">{row.updatedAt?.slice(0, 19) ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="mr-2 text-sky-400"
                      onClick={() => {
                        setEditingId(row.articleId);
                        setTitle(row.title);
                        setBody(row.body);
                        setSource(row.source ?? "");
                        setSourceType((row.sourceType as typeof sourceType) || "manual");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-rose-300"
                      onClick={() => remove.mutate(row.articleId)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
