import type { LexSlotValue } from "../types.js";

import { DISAMBIGUATION_RULES } from "./disambiguation.js";
import { addressSlotForIntent, slotNamesForIntent } from "./slot-catalog.js";

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

const PHONE_RE = /(?:\+?1[-.\s]?)?\(?([2-9]\d{2})\)?[-.\s]?([2-9]\d{2})[-.\s]?(\d{4})\b/;
const NAME_RE =
  /(?:my name is|this is|i(?:'m| am))\s+([A-Za-z][A-Za-z'-]{1,40})(?:\s+([A-Za-z][A-Za-z'-]{1,40}))?/i;
const ADDRESS_RE =
  /(?:corner of\s+.+?\s+and\s+.+)|(?:\d{1,5}\s+[A-Za-z0-9 .'-]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|court|ct)\b)/i;

function canWrite(intentName: string, slotName: string): boolean {
  const allowed = slotNamesForIntent(intentName);
  if (allowed.size === 0) return false;
  return allowed.has(slotName);
}

/**
 * Pre-fill slots from what the caller already said so we do not re-ask.
 * Only writes slots that exist on the active intent — extra names make Lex
 * reject the dialog hook with DependencyFailedException.
 */
export function extractSlotsFromContext(
  intentName: string,
  transcript: string,
  slots: Record<string, LexSlotValue | null>,
  _sessionAttrs: Record<string, string>,
): Record<string, LexSlotValue | null> {
  let next = { ...slots };
  const text = transcript.trim();
  if (!text) return next;

  if (canWrite(intentName, "IsOngoing") && !slotInterpreted(next.IsOngoing)) {
    if (
      /blocking|holding up|in the road|in the street|still there|right now|just happened|currently|blocking traffic|holding up traffic/i.test(
        text,
      )
    ) {
      next = setSlot(next, "IsOngoing", "HAPPENING_NOW");
    } else if (/been there (for|since)|days|weeks|keeps|every (day|night)|all the time|repeatedly/i.test(text)) {
      next = setSlot(next, "IsOngoing", "ONGOING_CHRONIC");
    } else if (/earlier|this morning|yesterday|already happened|last night|a while ago/i.test(text)) {
      next = setSlot(next, "IsOngoing", "ALREADY_HAPPENED");
    }
  }

  const addressSlot = addressSlotForIntent(intentName);
  if (addressSlot && !slotInterpreted(next[addressSlot])) {
    const addr = text.match(ADDRESS_RE);
    if (addr?.[0]) {
      next = setSlot(next, addressSlot, addr[0].trim());
    }
  }

  if (canWrite(intentName, "CallerName") && !slotInterpreted(next.CallerName)) {
    const nameMatch = text.match(NAME_RE);
    if (nameMatch?.[1]) {
      const full = [nameMatch[1], nameMatch[2]].filter(Boolean).join(" ");
      if (!/^(anonymous|anon)$/i.test(full)) {
        next = setSlot(next, "CallerName", full);
      }
    }
  }

  if (canWrite(intentName, "CallbackNumber") && !slotInterpreted(next.CallbackNumber)) {
    const phone = text.match(PHONE_RE);
    if (phone) {
      next = setSlot(next, "CallbackNumber", `+1${phone[1]}${phone[2]}${phone[3]}`);
    }
  }

  if (canWrite(intentName, "PublicWorksIssueType") && !slotInterpreted(next.PublicWorksIssueType)) {
    if (/potholes?/i.test(text)) {
      next = setSlot(next, "PublicWorksIssueType", "pothole");
    }
  }

  for (const rule of DISAMBIGUATION_RULES) {
    if (rule.intentName !== intentName) continue;
    if (slotInterpreted(next[rule.subIssueSlotName])) break;
    const result = rule.check(text);
    if (result?.inferredSubIssue && canWrite(intentName, rule.subIssueSlotName)) {
      next = setSlot(next, rule.subIssueSlotName, result.inferredSubIssue);
      if (result.inferredIsOngoing && canWrite(intentName, "IsOngoing") && !slotInterpreted(next.IsOngoing)) {
        next = setSlot(next, "IsOngoing", result.inferredIsOngoing);
      }
    }
    break;
  }

  return next;
}
