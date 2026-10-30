"use client";

import { useEffect, useMemo, useState } from "react";
import {
  OPERATOR_HANDLING,
  SCENE_RULES,
  SCENE_VERTICALS,
  handlingLabel,
  handlingPulsesWatchDesk,
  resolveHandling,
  type OperatorHandling,
  type ScenePolicyOverrides,
  type SceneRuleGroup,
  type SceneVertical,
} from "@/lib/rapid-vision/scene-monitoring-profiles";

const STORAGE_KEY = "nexcort-scene-monitoring-profile";

const COMPARE_DEFAULT = "person_down_athletic";

function readOverrides(): ScenePolicyOverrides {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ScenePolicyOverrides;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function SceneMonitoringProfiles() {
  const [vertical, setVertical] = useState<SceneVertical>("campus");
  const [compareId, setCompareId] = useState<string>(COMPARE_DEFAULT);
  const [overrides, setOverrides] = useState<ScenePolicyOverrides>({});

  useEffect(() => {
    setOverrides(readOverrides());
  }, []);

  const place = SCENE_VERTICALS.find((item) => item.id === vertical);
  const groups = useMemo(() => {
    const order: SceneRuleGroup[] = [];
    for (const rule of SCENE_RULES) {
      if (!order.includes(rule.group)) order.push(rule.group);
    }
    return order;
  }, []);

  function setHandling(ruleId: string, handling: OperatorHandling) {
    const next: ScenePolicyOverrides = {
      ...overrides,
      [vertical]: { ...overrides[vertical], [ruleId]: handling },
    };
    setOverrides(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function resetVertical() {
    const next = { ...overrides };
    delete next[vertical];
    setOverrides(next);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const compareRule = SCENE_RULES.find((rule) => rule.id === compareId) ?? SCENE_RULES[0];

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-sm font-semibold text-white">Scene monitoring profiles</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          The same scene is not the same operational concern in every place. These policies tell the watch desk how to handle a possible event. They do not start a detector, and they do not create a CAD incident.
        </p>
      </header>

      <div className="rounded-lg border border-slate-800 bg-[#0c1220] p-3">
        <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Same event, different place
          <select
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            value={compareId}
            onChange={(event) => setCompareId(event.target.value)}
          >
            {SCENE_RULES.map((rule) => (
              <option key={rule.id} value={rule.id}>
                {rule.scenario}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">{compareRule?.context}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SCENE_VERTICALS.map((item) => {
            const handling = resolveHandling(item.id, compareRule?.id ?? "", overrides);
            return (
              <li key={item.id} className="rounded-md border border-slate-800 px-2 py-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className={`text-sm font-medium ${handlingPulsesWatchDesk(handling) ? "text-red-200" : "text-slate-100"}`}>
                  {handlingLabel(handling)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Scene monitoring vertical">
        {SCENE_VERTICALS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={vertical === item.id}
            onClick={() => setVertical(item.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              vertical === item.id ? "bg-cyan-900/60 text-cyan-100" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-300">
          {place?.place}. Priority review can pulse the watch desk. Review alert and low-priority review do not. Camera health never pulses red.
        </p>
        <button type="button" onClick={resetVertical} className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300">
          Reset {place?.label} suggestions
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">{place?.label} scene monitoring rules</caption>
          <thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Detection scenario</th>
              <th className="px-3 py-2 font-semibold">Operator handling</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <GroupRows
                key={group}
                group={group}
                vertical={vertical}
                overrides={overrides}
                onChange={setHandling}
              />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Changes are saved on this console for the demonstration. A production policy change still needs an authorized administrator and an audit record. No detection category is activated for live operations from this screen.
      </p>
    </section>
  );
}

function GroupRows({
  group,
  vertical,
  overrides,
  onChange,
}: {
  group: SceneRuleGroup;
  vertical: SceneVertical;
  overrides: ScenePolicyOverrides;
  onChange: (ruleId: string, handling: OperatorHandling) => void;
}) {
  const rules = SCENE_RULES.filter((rule) => rule.group === group);
  return (
    <>
      <tr className="bg-slate-900/80">
        <th colSpan={2} className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-cyan-300/80">
          {group}
        </th>
      </tr>
      {rules.map((rule) => {
        const handling = resolveHandling(vertical, rule.id, overrides);
        return (
          <tr key={rule.id} className="border-t border-slate-800">
            <td className="px-3 py-2 align-top">
              <p className="text-slate-100">{rule.scenario}</p>
              <p className="mt-0.5 text-xs text-slate-500">{rule.context}</p>
            </td>
            <td className="px-3 py-2 align-top">
              <select
                aria-label={`${rule.scenario} handling`}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100"
                value={handling}
                onChange={(event) => onChange(rule.id, event.target.value as OperatorHandling)}
              >
                {OPERATOR_HANDLING.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </td>
          </tr>
        );
      })}
    </>
  );
}
