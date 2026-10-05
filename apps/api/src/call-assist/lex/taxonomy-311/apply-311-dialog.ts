import type { LexSlotValue, LexV2Event, LexV2Response } from "../types.js";
import { delegateResponse, elicitSlotResponse, plain } from "../lex-responses.js";
import { INTENT_MAP } from "./intents.js";
import { DISAMBIGUATION_RULES } from "./disambiguation.js";

export const LEX_311_INTENT_NAMES = Object.keys(INTENT_MAP);

function slotInterpreted(slot: LexSlotValue | null | undefined): string | null {
  return slot?.value?.interpretedValue?.trim() || slot?.value?.originalValue?.trim() || null;
}

function setSlot(
  slots: Record<string, LexSlotValue | null>,
  name: string,
  value: string,
): Record<string, LexSlotValue | null> {
  return {
    ...slots,
    [name]: {
      value: { originalValue: value, interpretedValue: value, resolvedValues: [value] },
    },
  };
}

/**
 * Category-intent disambiguation for 311 taxonomy intents.
 * Returns null when the current intent is not a 311 category intent, or when
 * Lex should keep eliciting normally.
 */
export function apply311Dialog(
  event: LexV2Event,
  intentName: string,
  slots: Record<string, LexSlotValue | null>,
  sessionAttrs: Record<string, string>,
): LexV2Response | null {
  const intentDef = INTENT_MAP[intentName];
  if (!intentDef) return null;

  const transcript = event.inputTranscript ?? "";

  if (intentName === "TransferToLiveAgent") {
    return null;
  }
  if (intentName === "RedirectToEmergencyServices") {
    return null;
  }

  if (intentDef.requiresDisambiguation) {
    for (const rule of DISAMBIGUATION_RULES) {
      if (rule.intentName !== intentName) continue;
      const current = slotInterpreted(slots[rule.subIssueSlotName]);
      if (current) break;
      const result = rule.check(transcript);
      if (!result) break;
      if (result.elevated) sessionAttrs.elevatedPriority = "true";
      if (result.inferredSubIssue) {
        const nextSlots = setSlot(slots, rule.subIssueSlotName, result.inferredSubIssue);
        const override = intentDef.conditionalDepartmentRouting?.[result.inferredSubIssue];
        if (override) sessionAttrs.overrideDepartment = override;
        sessionAttrs.subIssueType = result.inferredSubIssue;
        sessionAttrs.category = intentDef.category;
        sessionAttrs.department = override ?? intentDef.primaryDepartment;
        return delegateResponse(intentName, nextSlots, sessionAttrs, false);
      }
      if (result.clarificationQuestion) {
        return elicitSlotResponse(intentName, rule.subIssueSlotName, slots, sessionAttrs, [
          plain(result.clarificationQuestion),
        ]);
      }
    }
  }

  const subIssueSlot = intentDef.slots.find(
    (s) => s.slotTypeName.includes("SubIssue") || s.name.toLowerCase().includes("subissue"),
  );
  if (subIssueSlot && intentDef.conditionalDepartmentRouting) {
    const subIssue = slotInterpreted(slots[subIssueSlot.name]);
    if (subIssue && intentDef.conditionalDepartmentRouting[subIssue]) {
      sessionAttrs.overrideDepartment = intentDef.conditionalDepartmentRouting[subIssue];
    }
    if (subIssue) sessionAttrs.subIssueType = subIssue;
  }
  sessionAttrs.category = intentDef.category;
  sessionAttrs.department = sessionAttrs.overrideDepartment ?? intentDef.primaryDepartment;
  return null;
}
