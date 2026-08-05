"use client";

import { useEffect, useRef, useState } from "react";
import {
  PSAP_OUTREACH_STATUSES,
  PSAP_OUTREACH_STATUS_CONFIG,
  type PsapOutreachStatus,
} from "rapid-cortex-shared";
import { PsapStatusBadge } from "./PsapStatusBadge";

type Props = {
  status: PsapOutreachStatus;
  onSelect: (status: PsapOutreachStatus) => void;
  disabled?: boolean;
};

export function PsapQuickStatusMenu({ status, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <PsapStatusBadge
        status={status}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
      />
      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 max-h-64 w-48 overflow-y-auto rounded-md border border-[#1e2130] bg-[#0f1117] py-1 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {PSAP_OUTREACH_STATUSES.map((s) => {
            const cfg = PSAP_OUTREACH_STATUS_CONFIG[s];
            return (
              <button
                key={s}
                type="button"
                disabled={s === status}
                onClick={() => {
                  setOpen(false);
                  if (s !== status) onSelect(s);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-[#13161e] disabled:opacity-40 ${cfg.textClass}`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: cfg.mapPinColor }}
                />
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
