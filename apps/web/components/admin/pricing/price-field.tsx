"use client";

import { useCallback, useState } from "react";

export interface PriceFieldProps {
  priceKey: string;
  prefix?: string;
  suffix?: string;
  inputWidth?: number;
  decimals?: number;
  editMode: boolean;
  stagedValue?: number;
  effectiveValue: number;
  defaultValue: number;
  isGlobalOverride: boolean;
  isTenantOverride: boolean;
  onStage: (key: string, value: number) => void;
  onRevert: (key: string) => void;
}

function formatAmount(value: number, decimals: number, prefix: string): string {
  if (decimals > 0) {
    return `${prefix}${value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  return `${prefix}${Math.round(value).toLocaleString()}`;
}

export function PriceField({
  priceKey,
  prefix = "$",
  suffix = "",
  inputWidth = 88,
  decimals = 0,
  editMode,
  stagedValue,
  effectiveValue,
  defaultValue,
  isGlobalOverride,
  isTenantOverride,
  onStage,
  onRevert,
}: PriceFieldProps) {
  const isStaged = stagedValue !== undefined;
  const displayValue = isStaged ? stagedValue : effectiveValue;
  const [draft, setDraft] = useState<string>(String(displayValue));

  const handleBlur = useCallback(() => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(displayValue));
      return;
    }
    const normalized = decimals > 0 ? Math.round(parsed * 100) / 100 : Math.round(parsed);
    if (normalized === effectiveValue) {
      onStage(priceKey, normalized);
      setDraft(String(effectiveValue));
      return;
    }
    onStage(priceKey, normalized);
    setDraft(String(normalized));
  }, [draft, decimals, displayValue, effectiveValue, onStage, priceKey]);

  if (editMode) {
    const borderClass = isStaged
      ? "border-amber-500"
      : isTenantOverride
        ? "border-amber-500"
        : isGlobalOverride
          ? "border-emerald-500"
          : "border-slate-600";

    return (
      <span className="inline-flex items-center gap-1">
        <input
          type="number"
          step={decimals > 0 ? "0.01" : "1"}
          className={`rounded-md border bg-slate-950 px-2 py-1 text-sm text-white ${borderClass}`}
          style={{ width: inputWidth }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleBlur}
        />
        {suffix ? <span className="text-xs text-slate-400">{suffix}</span> : null}
        {(isStaged || isTenantOverride) && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-white"
            onClick={() => onRevert(priceKey)}
            title="Revert to previous value"
          >
            ↺
          </button>
        )}
      </span>
    );
  }

  let colorClass = "text-slate-100";
  let indicator: React.ReactNode = null;
  let title: string | undefined;

  if (isStaged) {
    colorClass = "text-amber-400";
    indicator = <sup className="ml-0.5 text-[10px] text-amber-400">↑</sup>;
    title = "Unsaved — click to revert";
  } else if (isTenantOverride) {
    colorClass = "text-amber-400";
    indicator = (
      <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">⊖</span>
    );
    title = `Global: ${formatAmount(defaultValue, decimals, prefix)}`;
  } else if (isGlobalOverride) {
    colorClass = "text-emerald-400";
    indicator = <sup className="ml-0.5 text-[10px] text-emerald-400">*</sup>;
    title = `Default: ${formatAmount(defaultValue, decimals, prefix)}`;
  }

  return (
    <span
      className={`inline-flex items-center font-medium ${colorClass}`}
      title={title}
      onClick={isStaged ? () => onRevert(priceKey) : undefined}
      role={isStaged ? "button" : undefined}
    >
      {formatAmount(displayValue, decimals, prefix)}
      {suffix ? <span className="ml-1 text-xs font-normal text-slate-400">{suffix}</span> : null}
      {indicator}
    </span>
  );
}
