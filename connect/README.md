# Amazon Connect — Call Assist contact flow

Import the flow **after** `rapid-cortex-lex-{stage}` is CREATE_COMPLETE. The Get customer input block needs the live bot alias ARN from stack outputs (`BotAliasArn`).

Do **not** import before the Lex bot is built. Locale build takes 3–5 minutes after the first deploy.

## Prerequisites

1. `source scripts/env-api-dev.sh && bash scripts/deploy-lex.sh dev`
2. Note outputs: `BotId`, `BotAliasId`, `BotAliasArn`
3. Seed the tenant test DID (never a live 911 number):

   ```bash
   source scripts/env-api-dev.sh
   export KCPD_TEST_DID="+1XXXXXXXXXX"
   export LEX_BOT_ID="…"
   export LEX_BOT_ALIAS_ID="…"
   CALL_ASSIST_SEED_PROFILE=kcpd bash scripts/seed-kcpd-connect.sh
   ```

4. Three dialog-hook safety-gate tests passing (`apps/api/src/call-assist/lex/__tests__/dialog-hook.test.ts`)
5. `GetAgencyConfigForNumber` Lambda deployed (or invoke the TypeScript handler `apps/api/src/call-assist/lex/get-agency-for-number.ts`) so call-start can load tenant config from the DID lookup row

After import:

1. Open the flow in the Connect console.
2. Add **Set voice** before Get customer input: Ruth, neural, **Set language attribute** = `en-US` (required for Lex V2). For Spanish, Lupe + `es-US`.
3. Point EmergencyEscalation and FallbackIntent transfer blocks at the dispatcher queues (not created by this repo).
4. Associate the GetAgencyConfig Lambda (`rapid-cortex-lex-agency-for-number-dev`) with the Connect instance.
5. Claim/assign the **test DID only** — never a live 911 number — and attach this flow.

Live Lex alias used by this JSON:

`arn:aws:lex:us-east-1:158961537080:bot-alias/IJIBJOJG2L/0CNPVSCF4V`

(`RCCallAssistBot-dev` / `live-dev`)

1. Invoke Lambda `GetAgencyConfigForNumber` with `phoneNumber = $.SystemEndpoint.Address`
2. Play disclosure from the Lambda result (Polly Ruth / Lupe)
3. Get customer input → Amazon Lex bot `RCCallAssistBot-{stage}` alias `live-{stage}`
   - Session attributes: `agencyId`, `callId = $.ContactId`, `callStartedAt`
4. Branch on `$.Lex.IntentName`
   - `EmergencyEscalation` → set `transferSummary` / `transcript` from Lex session attributes → warm transfer emergency queue
   - `FallbackIntent` → non-emergency dispatcher queue
   - else AI-resolved → play `closingMessage` → disconnect
5. On Lex/Lambda error → transfer to non-emergency queue

CAD write-back stays off. Fulfillment writes DynamoDB only.

## kcpd-06 (demo centerpiece)

Caller: “suspicious person” → then “he just pulled out a gun”. Safety gate on turn two must transfer with `transferSummary` in contact attributes for dispatcher pickup. Target reliability: before 2026-09-30.
