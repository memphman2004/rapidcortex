"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import {
  K12_INCIDENT_GROUPS,
  getK12FollowUpQuestions,
  getK12TypesInGroup,
  type CampusIncidentTypeConfig,
  type K12FollowUpQuestion,
  type K12IncidentGroupId,
} from "rapid-cortex-shared";
import { SAFETY_BRAND } from "./tokens";

export type K12FollowUpAnswers = Record<string, string | boolean | undefined>;

type K12ConcernPickerProps = {
  types: readonly CampusIncidentTypeConfig[];
  /** Selected incident type value (e.g. weapon_concern). */
  selectedType: string | null;
  followUpAnswers: K12FollowUpAnswers;
  onSelectType: (typeValue: string | null) => void;
  onFollowUpChange: (answers: K12FollowUpAnswers) => void;
};

const chipClass =
  "min-h-10 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition";

const fieldClass =
  "mt-1.5 w-full rounded-xl border bg-white px-3.5 py-3 text-base outline-none transition focus:ring-2";

function FollowUpField({
  question,
  value,
  onChange,
}: {
  question: K12FollowUpQuestion;
  value: string | boolean | undefined;
  onChange: (next: string | boolean | undefined) => void;
}) {
  if (question.fieldType === "boolean") {
    const selected = typeof value === "boolean" ? value : null;
    return (
      <fieldset>
        <legend className="text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
          {question.prompt}
          {question.required ? (
            <span style={{ color: SAFETY_BRAND.rapidRed }}> *</span>
          ) : null}
        </legend>
        <div className="mt-2 flex gap-2">
          {[
            { label: "Yes", val: true as const },
            { label: "No", val: false as const },
          ].map((opt) => {
            const isOn = selected === opt.val;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => onChange(opt.val)}
                className={chipClass}
                style={{
                  borderColor: isOn ? SAFETY_BRAND.deepBlue : SAFETY_BRAND.border,
                  backgroundColor: isOn ? `${SAFETY_BRAND.deepBlue}12` : SAFETY_BRAND.white,
                  color: isOn ? SAFETY_BRAND.deepBlue : SAFETY_BRAND.textDark,
                }}
                aria-pressed={isOn}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        {question.helpText ? (
          <p className="mt-1 text-xs" style={{ color: SAFETY_BRAND.muted }}>
            {question.helpText}
          </p>
        ) : null}
      </fieldset>
    );
  }

  if (question.fieldType === "select") {
    return (
      <label className="block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
        {question.prompt}
        {question.required ? (
          <span style={{ color: SAFETY_BRAND.rapidRed }}> *</span>
        ) : null}
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || undefined)}
          className={fieldClass}
          style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
          required={question.required}
        >
          <option value="">Select…</option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (question.fieldType === "textarea") {
    return (
      <label className="block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
        {question.prompt}
        {question.required ? (
          <span style={{ color: SAFETY_BRAND.rapidRed }}> *</span>
        ) : null}
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={fieldClass}
          style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
          required={question.required}
        />
      </label>
    );
  }

  return (
    <label className="block text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
      {question.prompt}
      {question.required ? (
        <span style={{ color: SAFETY_BRAND.rapidRed }}> *</span>
      ) : null}
      <input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
        style={{ borderColor: SAFETY_BRAND.border, color: SAFETY_BRAND.textDark }}
        required={question.required}
      />
    </label>
  );
}

/**
 * Two-step K-12 concern picker: parent category → specific type → dynamic follow-ups.
 * Avoids dumping ~40 types as one flat chip list.
 */
export function K12ConcernPicker({
  types,
  selectedType,
  followUpAnswers,
  onSelectType,
  onFollowUpChange,
}: K12ConcernPickerProps) {
  const selected = selectedType ? types.find((t) => t.value === selectedType) : undefined;
  const [browseGroupId, setBrowseGroupId] = useState<K12IncidentGroupId | null>(null);

  if (selected) {
    const questions = getK12FollowUpQuestions(selected.value);
    return (
      <div className="mb-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: SAFETY_BRAND.muted }}>
              Concern type
            </p>
            <p className="text-sm font-semibold" style={{ color: SAFETY_BRAND.textDark }}>
              {selected.label}
            </p>
            {selected.description ? (
              <p className="mt-0.5 text-xs" style={{ color: SAFETY_BRAND.muted }}>
                {selected.description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectType(null);
              onFollowUpChange({});
              setBrowseGroupId(selected.groupId ?? null);
            }}
            className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold"
            style={{ color: SAFETY_BRAND.deepBlue }}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Change
          </button>
        </div>

        {questions.length > 0 ? (
          <div className="space-y-4 rounded-xl border p-3" style={{ borderColor: SAFETY_BRAND.border }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: SAFETY_BRAND.muted }}>
              Follow-up questions
            </p>
            {questions.map((q) => (
              <FollowUpField
                key={q.id}
                question={q}
                value={followUpAnswers[q.id]}
                onChange={(next) => onFollowUpChange({ ...followUpAnswers, [q.id]: next })}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (browseGroupId) {
    const group = K12_INCIDENT_GROUPS.find((g) => g.id === browseGroupId);
    const inGroup = getK12TypesInGroup(types, browseGroupId);
    return (
      <fieldset className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <legend className="text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
            {group?.label ?? "Concern type"}
          </legend>
          <button
            type="button"
            onClick={() => setBrowseGroupId(null)}
            className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold"
            style={{ color: SAFETY_BRAND.deepBlue }}
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Categories
          </button>
        </div>
        {group?.description ? (
          <p className="mb-2 text-xs" style={{ color: SAFETY_BRAND.muted }}>
            {group.description}
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          {inGroup.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => {
                onSelectType(type.value);
                onFollowUpChange({});
              }}
              className={`${chipClass} w-full`}
              style={{
                borderColor: SAFETY_BRAND.border,
                backgroundColor: SAFETY_BRAND.white,
                color: SAFETY_BRAND.textDark,
              }}
            >
              <span className="block font-semibold">{type.label}</span>
              {type.description ? (
                <span className="mt-0.5 block font-normal opacity-70">{type.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset className="mb-4">
      <legend className="text-sm font-medium" style={{ color: SAFETY_BRAND.textDark }}>
        What kind of concern?{" "}
        <span className="font-normal" style={{ color: SAFETY_BRAND.muted }}>
          (optional)
        </span>
      </legend>
      <p className="mt-1 text-xs" style={{ color: SAFETY_BRAND.muted }}>
        Choose a category, then a specific type. Follow-up questions adapt to your selection.
      </p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {K12_INCIDENT_GROUPS.map((group) => {
          const count = getK12TypesInGroup(types, group.id).length;
          if (count === 0) return null;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setBrowseGroupId(group.id)}
              className={`${chipClass} w-full`}
              style={{
                borderColor: SAFETY_BRAND.border,
                backgroundColor: SAFETY_BRAND.white,
                color: SAFETY_BRAND.textDark,
              }}
            >
              <span className="block font-semibold">{group.label}</span>
              <span className="mt-0.5 block font-normal opacity-70">{group.description}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
