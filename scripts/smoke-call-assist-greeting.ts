/**
 * Call Assist greeting smoke — no AWS required.
 * Verifies en-US / es-US greetings and each escalationMode, including silent_transfer.
 *
 *   npx tsx scripts/smoke-call-assist-greeting.ts
 */
import {
  buildEscalationAnnouncement,
  buildGreeting,
  checkEscalation,
  DEFAULT_GREETING_CONFIG,
} from "../packages/shared/src/call-assist/greeting.ts";

const config = {
  ...DEFAULT_GREETING_CONFIG,
  cityName: "City of Springfield",
  agencyName: "Springfield Police Department",
  greetingPreviewConfirmed: true,
};

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

const en = buildGreeting(config, "en-US");
const es = buildGreeting(config, "es-US");
assert(en.includes("City of Springfield"), "en-US greeting missing city");
assert(es.includes("City of Springfield"), "es-US greeting missing city");
assert(/9-1-1/.test(en) && /9-1-1/.test(es), "911 notice missing");
assert(!/Kansas City|KCPD/i.test(en + es), "greeting leaked first-tenant copy");

for (const mode of ["announce_and_transfer", "announce_and_end", "silent_transfer"] as const) {
  const row = { ...config, escalationMode: mode };
  const spoken = buildEscalationAnnouncement(row, "en-US");
  const check = checkEscalation("he has a gun", row, "en-US");
  assert(check.escalate, `${mode} must still escalate`);
  if (mode === "silent_transfer") {
    assert(spoken === "" && check.announcement === "", "silent_transfer must speak nothing");
  } else {
    assert(spoken.length > 20, `${mode} must speak an announcement`);
  }
}

console.log("Call Assist greeting smoke OK");
console.log("  en-US:", en.slice(0, 88) + "…");
console.log("  es-US:", es.slice(0, 88) + "…");
