"use client";

import { useEffect, useState } from "react";
import type { CadConnectorConfig, CadDepartmentType, CadRoutingCondition, CadRoutingRule } from "rapid-cortex-shared";
import { fetchCadConnectors, fetchCadRoutingRules, putCadRoutingRules } from "@/lib/cad-connector/cad-connector-api";

const DEPARTMENTS: CadDepartmentType[] = [
  "law_enforcement",
  "fire",
  "ems",
  "combined_fire_ems",
  "emergency_management",
  "combined_all",
];

function conditionSummary(rule: CadRoutingRule): string {
  if (rule.conditions.length === 0) return "catch-all";
  return rule.conditions
    .map((c) => {
      if (c.field === "callerLocation") return `zone=${c.zoneId}`;
      return `${c.field} ${c.operator} ${Array.isArray(c.value) ? c.value.join(",") : c.value}`;
    })
    .join(" · ");
}

function departmentCondition(value: CadDepartmentType): CadRoutingCondition {
  return { field: "department", operator: "eq", value };
}

export function CadRoutingBuilder() {
  const [rules, setRules] = useState<CadRoutingRule[]>([]);
  const [connectors, setConnectors] = useState<CadConnectorConfig[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    void Promise.all([fetchCadRoutingRules(), fetchCadConnectors()])
      .then(([r, c]) => {
        setRules(r);
        setConnectors(c);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Load failed"));
  }, []);

  const hasCatchAll = rules.some((r) => r.conditions.length === 0);

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-white">Routing rules</h1>
      {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}
      {!hasCatchAll ? (
        <p className="mb-3 rounded border border-amber-700 bg-amber-950/40 px-3 py-2 text-sm text-amber-200">
          No catch-all rule. Write-backs that match nothing will be blocked.
        </p>
      ) : null}
      <div className="space-y-2">
        {rules.map((rule, index) => (
          <div
            key={rule.ruleId}
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex == null || dragIndex === index) return;
              setRules((rows) => {
                const next = [...rows];
                const [moved] = next.splice(dragIndex, 1);
                if (moved) next.splice(index, 0, moved);
                return next.map((r, i) => ({ ...r, priority: i + 1 }));
              });
              setDragIndex(null);
            }}
            className="cursor-grab rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm"
          >
            <p className="font-medium text-slate-200">
              #{rule.priority} · {rule.description}
              {rule.requireSupervisorApproval ? (
                <span className="ml-2 rounded bg-amber-900 px-2 py-0.5 text-xs text-amber-200">approval required</span>
              ) : null}
            </p>
            <p className="text-xs text-slate-500">{conditionSummary(rule)}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <input
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={rule.description}
                onChange={(e) =>
                  setRules((rows) => rows.map((r, i) => (i === index ? { ...r, description: e.target.value } : r)))
                }
              />
              <select
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={rule.targetConnectorId}
                onChange={(e) =>
                  setRules((rows) => rows.map((r, i) => (i === index ? { ...r, targetConnectorId: e.target.value } : r)))
                }
              >
                <option value="">Target connector</option>
                {connectors.map((c) => (
                  <option key={c.connectorId} value={c.connectorId}>
                    {c.displayName}
                  </option>
                ))}
              </select>
              <select
                className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
                value={
                  rule.conditions[0]?.field === "department" && rule.conditions[0].operator === "eq"
                    ? rule.conditions[0].value
                    : ""
                }
                onChange={(e) =>
                  setRules((rows) =>
                    rows.map((r, i) =>
                      i === index
                        ? {
                            ...r,
                            conditions: e.target.value
                              ? [departmentCondition(e.target.value as CadDepartmentType)]
                              : [],
                          }
                        : r,
                    ),
                  )
                }
              >
                <option value="">Catch-all (no department filter)</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={rule.requireSupervisorApproval}
                onChange={(e) =>
                  setRules((rows) =>
                    rows.map((r, i) => (i === index ? { ...r, requireSupervisorApproval: e.target.checked } : r)),
                  )
                }
              />
              Require supervisor approval
            </label>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-3 rounded border border-slate-600 px-3 py-1.5 text-sm"
        onClick={() =>
          setRules((rows) => [
            ...rows,
            {
              ruleId: `cadr_${Date.now()}`,
              priority: rows.length + 1,
              description: "New rule",
              conditions: [],
              targetConnectorId: connectors[0]?.connectorId ?? "",
              requireSupervisorApproval: true,
              enabled: true,
            },
          ])
        }
      >
        Add rule
      </button>
      <button
        type="button"
        className="ml-2 mt-3 rounded bg-sky-700 px-3 py-1.5 text-sm"
        onClick={() =>
          void putCadRoutingRules(rules).catch((err: unknown) => setError(err instanceof Error ? err.message : "Save failed"))
        }
      >
        Save rules
      </button>
    </div>
  );
}
