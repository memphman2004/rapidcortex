"use client";

import { useMemo, useState } from "react";
import {
  DAYS_OF_WEEK,
  type AgencyNetworkPolicy,
  type DayOfWeek,
  type DailySchedule,
  type ShiftSchedule,
  defaultAgencyNetworkPolicy,
  isWithinAccessWindow,
} from "rapid-cortex-shared";
import { useNetworkPolicy, useNetworkPolicyAudit, useNetworkPolicyMutation } from "@/lib/hooks/use-network-policy";

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Detroit",
  "America/Indiana/Indianapolis",
];

type Props = {
  agencyId: string;
  agencyName: string;
  canEdit: boolean;
  backHref?: string;
};

function wafBadge(status: AgencyNetworkPolicy["wafSyncStatus"]): string {
  switch (status) {
    case "synced":
      return "Synced";
    case "syncing":
      return "Syncing…";
    case "error":
      return "Sync error";
    default:
      return "Not configured";
  }
}

function emptyDay(): DailySchedule {
  return { enabled: false, windows: [{ startHour: 6, startMinute: 0, endHour: 22, endMinute: 0 }] };
}

function ensureSchedule(policy: AgencyNetworkPolicy): ShiftSchedule {
  return (
    policy.shiftSchedule ?? {
      timezone: "America/New_York",
      schedule: Object.fromEntries(DAYS_OF_WEEK.map((d) => [d, emptyDay()])) as ShiftSchedule["schedule"],
    }
  );
}

export function NetworkPolicyEditor({ agencyId, agencyName, canEdit, backHref }: Props) {
  const { data, isLoading, error } = useNetworkPolicy(agencyId);
  const { data: auditItems } = useNetworkPolicyAudit(agencyId);
  const { patch, addCidr, removeCidr, resyncWaf } = useNetworkPolicyMutation(agencyId);
  const [tab, setTab] = useState<"ip" | "hours">("ip");
  const [cidrInput, setCidrInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [banner, setBanner] = useState<string | null>(null);
  const [publicIpHint, setPublicIpHint] = useState<string | null>(null);

  const policy = data?.policy ?? defaultAgencyNetworkPolicy();
  const wafStatus = data?.wafSyncStatus ?? policy.wafSyncStatus ?? "not_configured";
  const schedule = ensureSchedule(policy);

  const accessOpen = useMemo(() => {
    if (!policy.timeRestrictionEnabled || !policy.shiftSchedule) return true;
    return isWithinAccessWindow(policy.shiftSchedule);
  }, [policy.timeRestrictionEnabled, policy.shiftSchedule]);

  if (isLoading) return <p className="text-sm text-slate-400">Loading network policy…</p>;
  if (error || !data) {
    return <p className="text-sm text-rose-400">Could not load network policy.</p>;
  }

  async function savePatch(body: Parameters<typeof patch.mutateAsync>[0]) {
    if (!canEdit) return;
    try {
      await patch.mutateAsync(body);
      setBanner("Policy saved.");
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Save failed.");
    }
  }

  async function onAddCidr() {
    if (!canEdit) return;
    try {
      await addCidr.mutateAsync({ cidr: cidrInput.trim(), label: labelInput.trim() || "Network" });
      setCidrInput("");
      setLabelInput("");
      setBanner("CIDR added.");
    } catch (e) {
      setBanner(e instanceof Error ? e.message : "Could not add CIDR.");
    }
  }

  async function fetchCurrentIp() {
    try {
      const res = await fetch("https://checkip.amazonaws.com", { cache: "no-store" });
      const ip = (await res.text()).trim();
      const masked = ip.includes(".")
        ? ip.replace(/\.\d+$/, ".xxx")
        : ip;
      setPublicIpHint(`Add ${ip}/32 for this device (seen as ${masked} in logs).`);
      setCidrInput(`${ip}/32`);
    } catch {
      setPublicIpHint("Could not detect public IP.");
    }
  }

  function updateDay(day: DayOfWeek, daily: DailySchedule) {
    const next: ShiftSchedule = {
      timezone: schedule.timezone,
      schedule: { ...schedule.schedule, [day]: daily },
    };
    void savePatch({ shiftSchedule: next });
  }

  function copyScheduleToAll(source: DayOfWeek) {
    const src = schedule.schedule[source];
    const nextSchedule = Object.fromEntries(
      DAYS_OF_WEEK.map((d) => [d, { ...src, windows: src.windows.map((w) => ({ ...w })) }]),
    ) as ShiftSchedule["schedule"];
    void savePatch({ shiftSchedule: { timezone: schedule.timezone, schedule: nextSchedule } });
  }

  return (
    <div className="space-y-6">
      {backHref ? (
        <a href={backHref} className="text-sm text-sky-400 hover:text-sky-300">
          ← Back
        </a>
      ) : null}
      {banner ? (
        <p className="rounded-md border border-sky-800/60 bg-sky-950/40 px-4 py-3 text-sm text-sky-100">{banner}</p>
      ) : null}

      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${tab === "ip" ? "bg-slate-700 text-white" : "text-slate-400"}`}
          onClick={() => setTab("ip")}
        >
          IP allowlist
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1.5 text-sm ${tab === "hours" ? "bg-slate-700 text-white" : "text-slate-400"}`}
          onClick={() => setTab("hours")}
        >
          Access hours
        </button>
      </div>

      {tab === "ip" ? (
        <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={policy.ipAllowlistEnabled}
                disabled={!canEdit || patch.isPending}
                onChange={(e) => void savePatch({ ipAllowlistEnabled: e.target.checked })}
              />
              Enable IP allowlist
            </label>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                wafStatus === "error"
                  ? "bg-rose-900/50 text-rose-200"
                  : wafStatus === "syncing"
                    ? "bg-amber-900/50 text-amber-100"
                    : "bg-slate-800 text-slate-300"
              }`}
            >
              WAF: {wafBadge(wafStatus)}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Once enabled, users must connect from a listed network. Verify dispatch center IPs before enabling.
          </p>
          {wafStatus === "error" && canEdit ? (
            <button
              type="button"
              className="text-sm text-sky-400 hover:text-sky-300"
              disabled={resyncWaf.isPending}
              onClick={() => void resyncWaf.mutateAsync().then(() => setBanner("WAF sync requested."))}
            >
              Retry WAF sync
            </button>
          ) : null}

          <table className="w-full text-left text-sm text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500">
                <th className="py-2 pr-4">CIDR</th>
                <th className="py-2 pr-4">Label</th>
                <th className="py-2 pr-4">Added by</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policy.allowedCidrs.map((row) => (
                <tr key={row.cidr} className="border-b border-slate-900/80">
                  <td className="py-2 font-mono text-xs">{row.cidr}</td>
                  <td className="py-2">{row.label}</td>
                  <td className="py-2 text-slate-500">{row.addedBy}</td>
                  <td className="py-2">
                    {canEdit ? (
                      <button
                        type="button"
                        className="text-rose-400 hover:text-rose-300"
                        disabled={removeCidr.isPending}
                        onClick={() => void removeCidr.mutateAsync(row.cidr)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {canEdit ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                placeholder="203.0.113.0/24"
                value={cidrInput}
                onChange={(e) => setCidrInput(e.target.value)}
              />
              <input
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
                placeholder="Label"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
              />
              <button
                type="button"
                className="rounded bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-500"
                disabled={addCidr.isPending}
                onClick={() => void onAddCidr()}
              >
                Add CIDR
              </button>
              <button
                type="button"
                className="rounded border border-slate-600 px-3 py-2 text-sm text-slate-300"
                onClick={() => void fetchCurrentIp()}
              >
                What is my current IP?
              </button>
            </div>
          ) : null}
          {publicIpHint ? <p className="text-xs text-slate-400">{publicIpHint}</p> : null}
        </section>
      ) : (
        <section className="space-y-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={policy.timeRestrictionEnabled}
                disabled={!canEdit || patch.isPending}
                onChange={(e) => void savePatch({ timeRestrictionEnabled: e.target.checked })}
              />
              Enable shift-hour access windows
            </label>
            <span className="text-sm text-slate-400">
              Access is currently:{" "}
              <strong className={accessOpen ? "text-emerald-400" : "text-amber-300"}>
                {accessOpen ? "OPEN" : "CLOSED"}
              </strong>
            </span>
          </div>

          <label className="block text-sm text-slate-400">
            Timezone
            <input
              list="iana-timezones"
              className="mt-1 w-full max-w-md rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              defaultValue={schedule.timezone}
              disabled={!canEdit}
              onBlur={(e) => {
                const tz = e.target.value.trim();
                if (tz && tz !== schedule.timezone) {
                  void savePatch({ shiftSchedule: { ...schedule, timezone: tz } });
                }
              }}
            />
            <datalist id="iana-timezones">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={policy.allowEmergencyOverride}
              disabled={!canEdit || patch.isPending}
              onChange={(e) => void savePatch({ allowEmergencyOverride: e.target.checked })}
            />
            Allow supervisors to grant 4-hour emergency access tokens
          </label>

          <div className="space-y-3">
            {DAYS_OF_WEEK.map((day) => {
              const daily = schedule.schedule[day] ?? emptyDay();
              const win = daily.windows[0] ?? {
                startHour: 6,
                startMinute: 0,
                endHour: 22,
                endMinute: 0,
              };
              return (
                <div
                  key={day}
                  className="grid gap-2 rounded border border-slate-800/80 p-3 sm:grid-cols-[120px_1fr_auto]"
                >
                  <label className="flex items-center gap-2 capitalize text-slate-200">
                    <input
                      type="checkbox"
                      checked={daily.enabled}
                      disabled={!canEdit}
                      onChange={(e) =>
                        updateDay(day, { ...daily, enabled: e.target.checked })
                      }
                    />
                    {day}
                  </label>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="time"
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      disabled={!canEdit || !daily.enabled}
                      value={`${String(win.startHour).padStart(2, "0")}:${String(win.startMinute).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        updateDay(day, {
                          ...daily,
                          windows: [{ ...win, startHour: h, startMinute: m }],
                        });
                      }}
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="time"
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1"
                      disabled={!canEdit || !daily.enabled}
                      value={`${String(win.endHour).padStart(2, "0")}:${String(win.endMinute).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        updateDay(day, {
                          ...daily,
                          windows: [{ ...win, endHour: h, endMinute: m }],
                        });
                      }}
                    />
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      className="text-xs text-sky-400 hover:text-sky-300"
                      onClick={() => copyScheduleToAll(day)}
                    >
                      Copy to all days
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          {auditItems && auditItems.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-300">Recent network audit ({agencyName})</h3>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-500">
                {auditItems.slice(0, 10).map((ev) => (
                  <li key={ev.eventId}>
                    {ev.type} · {new Date(ev.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
