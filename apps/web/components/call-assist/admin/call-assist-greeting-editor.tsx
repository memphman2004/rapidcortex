"use client";

import { useMemo, useState } from "react";
import {
  buildEscalationAnnouncement,
  buildGreeting,
  DEFAULT_LINE_DESCRIPTION,
  greetingActivationBlockedReason,
  isCallAssistGreetingReady,
  resolveGreetingConfig,
  type CallAssistGreetingConfig,
  type EscalationMode,
  type GreetingMode,
} from "rapid-cortex-shared";

type Props = {
  config: Record<string, unknown>;
  pending: boolean;
  onSave: (greeting: CallAssistGreetingConfig) => void;
};

const MODE_LABELS: { id: GreetingMode; label: string; hint: string }[] = [
  { id: "hang_up", label: "Hang up and call 911", hint: "Required phrasing in some jurisdictions." },
  { id: "stay_on_line", label: "Stay on the line", hint: "Recommended when Rapid Cortex can detect and escalate." },
  { id: "custom", label: "Custom", hint: "Full text. Use {cityName} and {agencyName}." },
];

const ESCALATION_LABELS: { id: EscalationMode; label: string; hint: string; premium?: boolean }[] = [
  { id: "announce_and_transfer", label: "Announce then transfer", hint: "Speak, then connect to 911." },
  { id: "announce_and_end", label: "Announce then end", hint: "Speak hang-up instructions, then end the call." },
  { id: "silent_transfer", label: "Silent transfer", hint: "Fastest path — caller is talking to a dispatcher before RC speaks again.", premium: true },
];

export function CallAssistGreetingEditor({ config, pending, onSave }: Props) {
  const stored = resolveGreetingConfig({
    callAssistGreeting: config.callAssistGreeting as CallAssistGreetingConfig | undefined,
    tenantCity: config.tenantCity as string | undefined,
    agencyName: (config.agencyName as string | undefined) ?? (config.agencyDisplayName as string | undefined),
    emergencyDestination: config.emergencyDestination as string | undefined,
    connectEmergencyQueueArn: config.connectEmergencyQueueArn as string | undefined,
  });
  const [mode, setMode] = useState<GreetingMode | null>(null);
  const [cityName, setCityName] = useState<string | null>(null);
  const [agencyName, setAgencyName] = useState<string | null>(null);
  const [lineDescription, setLineDescription] = useState<string | null>(null);
  const [customGreetingText, setCustomGreetingText] = useState<string | null>(null);
  const [spanishGreeting, setSpanishGreeting] = useState<string | null>(null);
  const [escalationMode, setEscalationMode] = useState<EscalationMode | null>(null);
  const [emergencyTransferNumber, setEmergencyTransferNumber] = useState<string | null>(null);
  const [emergencyTransferQueue, setEmergencyTransferQueue] = useState<string | null>(null);
  const [escalationAnnouncementText, setEscalationAnnouncementText] = useState<string | null>(null);
  const [enableColdClimate, setEnableColdClimate] = useState<boolean | null>(null);
  const [enableLiveAgent, setEnableLiveAgent] = useState<boolean | null>(null);
  const [speakAnnouncement, setSpeakAnnouncement] = useState<boolean | null>(null);

  const draft: CallAssistGreetingConfig = useMemo(
    () => ({
      ...stored,
      mode: mode ?? stored.mode,
      cityName: cityName ?? stored.cityName,
      agencyName: agencyName ?? stored.agencyName,
      lineDescription: lineDescription ?? stored.lineDescription ?? DEFAULT_LINE_DESCRIPTION,
      customGreetingText: customGreetingText ?? stored.customGreetingText,
      localizedGreetings: {
        ...(stored.localizedGreetings ?? {}),
        "es-US": spanishGreeting ?? stored.localizedGreetings?.["es-US"] ?? "",
      },
      escalationMode: escalationMode ?? stored.escalationMode,
      emergencyTransferNumber: emergencyTransferNumber ?? stored.emergencyTransferNumber,
      emergencyTransferQueue: emergencyTransferQueue ?? stored.emergencyTransferQueue,
      speakEscalationAnnouncement: speakAnnouncement ?? stored.speakEscalationAnnouncement,
      escalationAnnouncementText: escalationAnnouncementText ?? stored.escalationAnnouncementText,
      enableColdClimateIntents: enableColdClimate ?? stored.enableColdClimateIntents,
      enableLiveAgentHandoff: enableLiveAgent ?? stored.enableLiveAgentHandoff,
    }),
    [
      stored,
      mode,
      cityName,
      agencyName,
      lineDescription,
      customGreetingText,
      spanishGreeting,
      escalationMode,
      emergencyTransferNumber,
      emergencyTransferQueue,
      speakAnnouncement,
      escalationAnnouncementText,
      enableColdClimate,
      enableLiveAgent,
    ],
  );

  const previewEn = buildGreeting(draft, "en-US");
  const previewEs = buildGreeting(draft, "es-US");
  const escalationEn = buildEscalationAnnouncement(draft, "en-US");
  const blocked = greetingActivationBlockedReason({ ...draft, greetingPreviewConfirmed: true });
  const ready = isCallAssistGreetingReady(draft);
  const transferMode = draft.escalationMode !== "announce_and_end";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border border-slate-800 p-4">
        <h2 className="text-sm font-semibold text-white">Greeting mode</h2>
        {MODE_LABELS.map((row) => (
          <label key={row.id} className="flex items-start gap-2 text-sm text-slate-200">
            <input
              type="radio"
              className="mt-1"
              checked={draft.mode === row.id}
              onChange={() => setMode(row.id)}
            />
            <span>
              {row.label}
              <span className="mt-0.5 block text-[11px] text-slate-500">{row.hint}</span>
            </span>
          </label>
        ))}
        <label className="block text-[12px] text-slate-400">
          City name
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            value={draft.cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="City of Springfield"
          />
        </label>
        <label className="block text-[12px] text-slate-400">
          Agency name
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            value={draft.agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Springfield Police Department"
          />
        </label>
        <label className="block text-[12px] text-slate-400">
          Line description
          <input
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
            value={draft.lineDescription}
            onChange={(e) => setLineDescription(e.target.value)}
            placeholder="non-emergency service line"
          />
        </label>
        {draft.mode === "custom" ? (
          <label className="block text-[12px] text-slate-400">
            Custom greeting
            <textarea
              className="mt-1 h-28 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
              maxLength={2000}
              value={draft.customGreetingText ?? ""}
              onChange={(e) => setCustomGreetingText(e.target.value)}
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              {(draft.customGreetingText ?? "").length}/2000 · {"{cityName}"} and {"{agencyName}"} are interpolated.
            </span>
          </label>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-slate-800 p-4">
        <h2 className="text-sm font-semibold text-white">Emergency response</h2>
        {ESCALATION_LABELS.map((row) => (
          <label key={row.id} className="flex items-start gap-2 text-sm text-slate-200">
            <input
              type="radio"
              className="mt-1"
              checked={draft.escalationMode === row.id}
              onChange={() => {
                setEscalationMode(row.id);
                if (row.id === "silent_transfer") setSpeakAnnouncement(false);
                if (row.id === "announce_and_transfer" || row.id === "announce_and_end") setSpeakAnnouncement(true);
              }}
            />
            <span>
              {row.label}
              {row.premium ? (
                <span className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-300">
                  Fastest
                </span>
              ) : null}
              <span className="mt-0.5 block text-[11px] text-slate-500">{row.hint}</span>
            </span>
          </label>
        ))}
        {transferMode ? (
          <>
            <label className="block text-[12px] text-slate-400">
              Emergency transfer number
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                value={draft.emergencyTransferNumber ?? ""}
                onChange={(e) => setEmergencyTransferNumber(e.target.value)}
                placeholder="911"
              />
            </label>
            <label className="block text-[12px] text-slate-400">
              Emergency queue
              <input
                className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
                value={draft.emergencyTransferQueue ?? ""}
                onChange={(e) => setEmergencyTransferQueue(e.target.value)}
                placeholder="Connect queue name or ARN"
              />
            </label>
          </>
        ) : null}
        {draft.escalationMode !== "silent_transfer" ? (
          <label className="block text-[12px] text-slate-400">
            Custom announcement (optional)
            <textarea
              className="mt-1 h-20 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
              maxLength={2000}
              value={draft.escalationAnnouncementText ?? ""}
              onChange={(e) => setEscalationAnnouncementText(e.target.value)}
            />
          </label>
        ) : (
          <p className="text-[12px] text-amber-200/90">Silent transfer speaks nothing. The caller is already with a dispatcher.</p>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-slate-800 p-4">
        <h2 className="text-sm font-semibold text-white">Spanish greeting</h2>
        <textarea
          className="h-28 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
          maxLength={2000}
          value={draft.localizedGreetings?.["es-US"] ?? ""}
          onChange={(e) => setSpanishGreeting(e.target.value)}
        />
        <p className="text-[11px] text-slate-500">Pre-filled from the Spanish template. Edit to match local phrasing.</p>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={draft.enableColdClimateIntents}
            onChange={(e) => setEnableColdClimate(e.target.checked)}
          />
          Cold-climate intents
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={draft.enableLiveAgentHandoff}
            onChange={(e) => setEnableLiveAgent(e.target.checked)}
          />
          Live agent handoff
        </label>
      </section>

      <section className="space-y-3 rounded-lg border border-sky-900/60 bg-sky-950/20 p-4">
        <h2 className="text-sm font-semibold text-white">Preview — what callers will hear</h2>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">English</p>
        <p className="text-sm text-slate-100">{previewEn}</p>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Spanish</p>
        <p className="text-sm text-slate-100">{previewEs}</p>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Escalation</p>
        <p className="text-sm text-slate-100">{escalationEn || "(silent — no announcement)"}</p>
        {!ready || blocked ? (
          <p className="text-[12px] text-amber-300">{blocked ?? "City and agency name are required before Call Assist can go live."}</p>
        ) : (
          <p className="text-[12px] text-emerald-400">Ready. Save to apply this greeting to every call, operator, and language.</p>
        )}
        <button
          type="button"
          className="rounded bg-sky-700 px-3 py-1.5 text-[12px] text-white disabled:opacity-50"
          disabled={pending || !draft.cityName.trim() || !draft.agencyName.trim()}
          onClick={() => onSave({ ...draft, greetingPreviewConfirmed: true })}
        >
          Save and confirm preview
        </button>
      </section>
    </div>
  );
}
