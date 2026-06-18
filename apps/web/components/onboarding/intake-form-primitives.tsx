"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function MultiStepShell({
  title,
  description,
  step,
  totalSteps,
  onBack,
  onNext,
  nextLabel = "Continue",
  backLabel = "Back",
  isNextDisabled,
  isSubmitting,
  children,
}: {
  title: string;
  description?: string;
  step: number;
  totalSteps: number;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  isNextDisabled?: boolean;
  isSubmitting?: boolean;
  children: ReactNode;
}) {
  const progress = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Step {step + 1} of {totalSteps}
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{title}</h1>
        {description ? <p className="mt-2 text-sm text-slate-400">{description}</p> : null}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">{children}</div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack || isSubmitting}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext || isNextDisabled || isSubmitting}
          className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
        >
          {isSubmitting ? "Saving…" : nextLabel}
          {!isSubmitting && step < totalSteps - 1 ? <ChevronRight className="h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}

export function Field({
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

export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
    />
  );
}

export function NumberInput({
  value,
  onChange,
  min = 0,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <input
      type="number"
      min={min}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
    />
  );
}

export function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
    />
  );
}

export function SelectInput<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
          <input
            type="radio"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="text-violet-500 focus:ring-violet-500"
          />
          {opt.label}
        </label>
      ))}
    </div>
  );
}

export function CheckboxGroup<T extends string>({
  values,
  onChange,
  options,
}: {
  values: T[];
  onChange: (v: T[]) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const checked = values.includes(opt.value);
        return (
          <label key={opt.value} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => {
                onChange(
                  checked ? values.filter((v) => v !== opt.value) : [...values, opt.value],
                );
              }}
              className="rounded text-violet-500 focus:ring-violet-500"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
