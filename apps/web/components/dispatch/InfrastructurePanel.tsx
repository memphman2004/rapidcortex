"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, CheckSquare, Phone, Square } from "lucide-react";
import type { CriticalInfrastructure, IncidentProtocol } from "rapid-cortex-shared";
import { featureSuiteFetch } from "@/lib/feature-suite-client";
import { isFeaturesSuiteUiEnabled } from "@/lib/runtime-flags";

type ListResponse = { infrastructure: CriticalInfrastructure[]; total: number };

type Props = {
  /** Match facility by street substring (case-insensitive). */
  addressHint?: string;
  /** Or pass a known infra record directly. */
  facility?: CriticalInfrastructure | null;
  className?: string;
};

export function InfrastructurePanel({ addressHint, facility: injected, className }: Props) {
  const enabled = isFeaturesSuiteUiEnabled();
  const [expandedProtocol, setExpandedProtocol] = useState<IncidentProtocol | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const listQ = useQuery({
    queryKey: ["infra-list"],
    queryFn: () => featureSuiteFetch<ListResponse>("infra"),
    enabled: enabled && !injected && Boolean(addressHint?.trim()),
    staleTime: 60_000,
  });

  const facility = useMemo(() => {
    if (injected) return injected;
    const hint = addressHint?.toLowerCase().trim();
    if (!hint || !listQ.data?.infrastructure) return null;
    return (
      listQ.data.infrastructure.find((f) => {
        const a = f.address;
        const blob = `${f.name} ${a.street} ${a.city}`.toLowerCase();
        return blob.includes(hint) || hint.includes(a.street.toLowerCase());
      }) ?? null
    );
  }, [injected, addressHint, listQ.data]);

  if (!enabled) return null;
  if (!facility) return null;

  const contacts = [
    facility.primaryContact,
    facility.afterHoursContact,
    facility.securityContact,
  ].filter(Boolean);

  return (
    <div
      className={`rounded-md border border-slate-700/80 border-l-4 border-l-violet-500 bg-[#161b2e] text-[#e2e4ea] ${className ?? ""}`}
    >
      <div className="flex items-start gap-2 px-3 py-2">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/90">
            Critical infrastructure
          </div>
          <div className="text-sm font-medium">{facility.name}</div>
          <div className="text-xs capitalize text-slate-400">
            {facility.infraType.replace(/_/g, " ")}
          </div>
        </div>
      </div>

      {facility.protocols?.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-slate-700/60 px-3 py-2">
          {facility.floorPlans?.[0]?.cloudFrontUrl && (
            <a
              href={facility.floorPlans[0].cloudFrontUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-slate-600 px-2 py-1 text-[11px] text-sky-300 hover:bg-slate-800"
            >
              View floor plan
            </a>
          )}
          {facility.protocols.map((p) => (
            <button
              key={p.protocolId}
              type="button"
              onClick={() =>
                setExpandedProtocol((cur) => (cur?.protocolId === p.protocolId ? null : p))
              }
              className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800"
            >
              {p.title}
            </button>
          ))}
        </div>
      )}

      {expandedProtocol && (
        <div className="border-t border-slate-700/60 px-3 py-2">
          <div className="mb-1 text-xs font-semibold text-violet-200">{expandedProtocol.title}</div>
          <ul className="space-y-1.5">
            {expandedProtocol.steps
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((step) => {
                const id = `${expandedProtocol.protocolId}-${step.order}`;
                const done = Boolean(checked[id]);
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setChecked((c) => ({ ...c, [id]: !done }))}
                      className="flex w-full items-start gap-2 text-left text-xs text-slate-300"
                    >
                      {done ? (
                        <CheckSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-400" />
                      ) : (
                        <Square className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                      )}
                      <span className={done ? "line-through text-slate-500" : ""}>
                        {step.action}
                        {step.responsible ? ` (${step.responsible})` : ""}
                        {step.timeframe ? ` · ${step.timeframe}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="border-t border-slate-700/60 px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            <Phone className="h-3 w-3" /> Contacts
          </div>
          <ul className="space-y-0.5 text-xs text-slate-300">
            {contacts.map((c, i) =>
              c ? (
                <li key={`${c.name}-${i}`}>
                  {c.role}: {c.name} — {c.phone}
                </li>
              ) : null,
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
