"use client";

import type { GuestAssistKnowledge, GuestAssistVertical } from "rapid-cortex-shared";
import { GUEST_ASSIST_KNOWLEDGE_FIELDS } from "rapid-cortex-shared";
import { Field, Textarea, TextInput } from "@/components/onboarding/intake-form-primitives";

type Props = {
  vertical: GuestAssistVertical;
  value: GuestAssistKnowledge;
  onChange: (next: Record<string, string>) => void;
};

function factValue(value: GuestAssistKnowledge, key: string): string {
  if (Object.prototype.hasOwnProperty.call(value, key)) {
    const raw = (value as Record<string, string>)[key];
    return typeof raw === "string" ? raw : "";
  }
  return "";
}

export function GuestAssistKnowledgeFields({ vertical, value, onChange }: Props) {
  const fields = GUEST_ASSIST_KNOWLEDGE_FIELDS[vertical];

  return (
    <div className="grid gap-5">
      <p className="text-sm text-slate-400">
        These facts are injected into Guest Assist (Claude) for this {vertical} only. Write the
        answers you want guests to receive for each scan-page category. Leave a field blank if
        that category should stay generic.
      </p>
      {fields.map((field) => {
        const current = factValue(value, field.key);
        const setValue = (next: string) => onChange({ ...value, [field.key]: next });
        return (
          <Field key={field.key} label={field.label} hint={field.hint}>
            {field.input === "text" ? (
              <TextInput value={current} onChange={setValue} placeholder={field.placeholder} />
            ) : (
              <Textarea value={current} onChange={setValue} placeholder={field.placeholder} rows={4} />
            )}
          </Field>
        );
      })}
    </div>
  );
}
