#!/usr/bin/env bash
# KCPD Nova Sonic S2S smoke (unit + mock stream). Lex fallback when flag off.
# Usage: bash scripts/smoke-nova-sonic-kcpd.sh [vehicle|emergency|report|fallback]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SCENARIO="${1:-vehicle}"
export NOVA_SONIC_BEDROCK_MOCK=1
export CALL_ASSIST_CONNECT_MOCK=true

case "$SCENARIO" in
  vehicle|emergency|report|fallback) ;;
  *)
    echo "Unknown scenario: $SCENARIO (vehicle|emergency|report|fallback)" >&2
    exit 1
    ;;
esac

echo "→ Building shared + api"
npm run -w rapid-cortex-shared build
npm run -w rapid-cortex-api build

echo "→ Unit tests (protocol + tools + mock stream)"
npm run -w rapid-cortex-shared exec -- vitest run src/call-assist/nova-sonic.test.ts
npm run -w rapid-cortex-api exec -- vitest run src/call-assist/nova-sonic/tools.test.ts src/call-assist/nova-sonic/bedrock-stream.test.ts

echo "→ Scenario mock stream: $SCENARIO"
node --input-type=module <<EOF
import { mockTextAudioChunk, runNovaSonicStreamMock } from "./apps/api/dist/call-assist/nova-sonic/bedrock-stream.js";

const scripts = {
  vehicle: ["There's a car been sitting on my street for three days.", "4500 Warwick", "That's all, can I get my report number?"],
  emergency: ["there's a fire in my kitchen right now"],
  report: ["Abandoned vehicle on Warwick.", "4500 Warwick Boulevard", "That's all", "Can you repeat the report number?"],
  fallback: ["I need to speak to a real person please"],
};
const utterances = scripts["$SCENARIO"];
async function* audio() {
  for (const u of utterances) yield mockTextAudioChunk(u);
}
const result = await runNovaSonicStreamMock({
  agencyId: "kcpd",
  contactId: "smoke-\${Date.now()}",
  promptName: "nexcortiq-kcpd",
  systemPrompt: "ASSISTANT IDENTITY\\nYou are Nexiq for Kansas City Police.",
  config: { confirmationPrefix: "KC", operatingHours: { timezone: "America/Chicago" } },
  audioSource: audio(),
});
console.log(JSON.stringify({ scenario: "$SCENARIO", handoff: result.handoff, confirmationNumber: result.intake.confirmationNumber ?? null }, null, 2));
const expectMap = {
  vehicle: () => result.handoff.callerDone === "true" && result.handoff.novaSessionStatus === "COMPLETED",
  emergency: () => result.handoff.emergencyEscalation === "true",
  report: () => result.handoff.callerDone === "true" && Boolean(result.intake.confirmationNumber),
  fallback: () => result.handoff.novaSonicFallbackToLex === "true",
};
if (!expectMap["$SCENARIO"]()) {
  console.error("Scenario assertion failed");
  process.exit(2);
}
EOF

echo "✅ smoke-nova-sonic-kcpd $SCENARIO ok"
echo "Live DID: ensure contact flow published with NovaSessionStart/Await ARNs; KCPD novaSonicEnabled=true."
echo "Rollback: SET novaSonicEnabled=false on rapid-cortex-call-assist-dev CONFIG#tenant"
