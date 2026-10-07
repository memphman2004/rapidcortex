import type { LexSlotValue, LexV2Event, LexV2Response } from "../types.js";
import { elicitSlotResponse, plain } from "../lex-responses.js";
import { INTENT_MAP } from "./intents.js";
import { DISAMBIGUATION_RULES } from "./disambiguation.js";
import { extractSlotsFromContext } from "./extract-slots-from-context.js";
import { getNextElicitation } from "./elicitation-questions.js";

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
 * Never returns Delegate with unfilled required slots — always ElicitSlot with a human question.
 */
export function apply311Dialog(
  event: LexV2Event,
  intentName: string,
  slots: Record<string, LexSlotValue | null>,
  sessionAttrs: Record<string, string>,
): LexV2Response | null {
  const intentDef = INTENT_MAP[intentName];
  if (!intentDef) return null;

  const utterance = event.inputTranscript ?? "";
  const transcript = [sessionAttrs.transcript ?? "", utterance ? `Caller: ${utterance}` : ""]
    .filter(Boolean)
    .join("|");

  if (intentName === "TransferToLiveAgent" || intentName === "RedirectToEmergencyServices") {
    return null;
  }

  let nextSlots = extractSlotsFromContext(intentName, `${transcript} ${utterance}`, slots, sessionAttrs);

  if (intentDef.requiresDisambiguation) {
    for (const rule of DISAMBIGUATION_RULES) {
      if (rule.intentName !== intentName) continue;
      const current = slotInterpreted(nextSlots[rule.subIssueSlotName]);
      if (current) break;
      const result = rule.check(utterance || transcript);
      if (!result) break;
      if (result.elevated) sessionAttrs.elevatedPriority = "true";
      if (result.inferredSubIssue) {
        nextSlots = setSlot(nextSlots, rule.subIssueSlotName, result.inferredSubIssue);
        if (result.inferredIsOngoing && !slotInterpreted(nextSlots.IsOngoing)) {
          nextSlots = setSlot(nextSlots, "IsOngoing", result.inferredIsOngoing);
        }
        const override = intentDef.conditionalDepartmentRouting?.[result.inferredSubIssue];
        if (override) sessionAttrs.overrideDepartment = override;
        sessionAttrs.subIssueType = result.inferredSubIssue;
        sessionAttrs.category = intentDef.category;
        sessionAttrs.department = override ?? intentDef.primaryDepartment;
        // Re-run context extract after sub-issue fill (e.g. IsOngoing from "downed tree").
        nextSlots = extractSlotsFromContext(
          intentName,
          `${transcript} ${utterance}`,
          nextSlots,
          sessionAttrs,
        );
        const next = getNextElicitation(intentName, nextSlots, transcript);
        if (next) {
          sessionAttrs.promptSlot = next.slotToElicit;
          return elicitSlotResponse(intentName, next.slotToElicit, nextSlots, sessionAttrs, [
            plain(next.question),
          ]);
        }
        // All required slots filled — let the main dialog hook fulfill / confirm.
        Object.assign(slots, nextSlots);
        return null;
      }
      if (result.clarificationQuestion) {
        return elicitSlotResponse(intentName, rule.subIssueSlotName, nextSlots, sessionAttrs, [
          plain(result.clarificationQuestion),
        ]);
      }
    }
  }

  const subIssueSlot = intentDef.slots.find(
    (s) => s.slotTypeName.includes("SubIssue") || s.name.toLowerCase().includes("subissue"),
  );
  if (subIssueSlot && intentDef.conditionalDepartmentRouting) {
    const subIssue = slotInterpreted(nextSlots[subIssueSlot.name]);
    if (subIssue && intentDef.conditionalDepartmentRouting[subIssue]) {
      sessionAttrs.overrideDepartment = intentDef.conditionalDepartmentRouting[subIssue];
    }
    if (subIssue) sessionAttrs.subIssueType = subIssue;
  }
  sessionAttrs.category = intentDef.category;
  sessionAttrs.department = sessionAttrs.overrideDepartment ?? intentDef.primaryDepartment;

  Object.assign(slots, nextSlots);

  const next = getNextElicitation(intentName, nextSlots, transcript);
  if (next) {
    sessionAttrs.promptSlot = next.slotToElicit;
    return elicitSlotResponse(intentName, next.slotToElicit, nextSlots, sessionAttrs, [
      plain(next.question),
    ]);
  }
  return null;
}
