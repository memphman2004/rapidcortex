/**
 * Call Assist — Lex V2 Bot Builder
 *
 * Programmatically creates all 311 slot types and intents in the target Lex V2 bot.
 * Safe to run repeatedly — upserts rather than blindly creating.
 *
 * Usage:
 *   BOT_ID=XXXXXXXXXX BOT_LOCALE=en_US npx ts-node build-bot.ts
 *
 * Required env:
 *   BOT_ID           - Lex V2 bot ID
 *   AWS_PROFILE      - AWS CLI profile (uses rc-aws standard)
 *   AWS_REGION       - Default: us-east-1
 *
 * Optional env:
 *   BOT_LOCALE       - Default: en_US
 *   DRY_RUN          - Set to "true" to log without writing
 *   INTENT_FILTER    - Comma-separated intent names to build (builds all if unset)
 */

import {
  LexModelsV2Client,
  CreateSlotTypeCommand,
  UpdateSlotTypeCommand,
  ListSlotTypesCommand,
  CreateIntentCommand,
  UpdateIntentCommand,
  ListIntentsCommand,
  DescribeIntentCommand,
  CreateSlotCommand,
  UpdateSlotCommand,
  DeleteSlotCommand,
  ListSlotsCommand,
  BuildBotLocaleCommand,
  DescribeBotLocaleCommand,
  type SlotTypeValue,
  type SlotValueSelectionSetting,
  type SampleUtterance,
  type SlotPriority,
  type FulfillmentCodeHookSettings,
  type DialogCodeHookSettings,
} from '@aws-sdk/client-lex-models-v2';

import { ALL_SLOT_TYPES } from '../apps/api/src/call-assist/lex/taxonomy-311/slot-types.js';
import { INTENTS } from '../apps/api/src/call-assist/lex/taxonomy-311/intents.js';
import type { BotBuildResult, CustomSlotTypeDefinition, IntentDefinition, SlotDefinition } from '../apps/api/src/call-assist/lex/taxonomy-311/types.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const BOT_ID     = process.env.BOT_ID ?? 'IJIBJOJG2L';
const BOT_VERSION = 'DRAFT';
const LOCALE_ID  = process.env.BOT_LOCALE ?? 'en_US';
const DRY_RUN    = process.env.DRY_RUN === 'true';
const REGION     = process.env.AWS_REGION ?? 'us-east-1';

const INTENT_FILTER = process.env.INTENT_FILTER
  ? new Set(process.env.INTENT_FILTER.split(',').map(s => s.trim()))
  : null;

/** When true, upsert slot types + build locale only (skip intent create/update). */
const SLOT_TYPES_ONLY = process.env.SLOT_TYPES_ONLY === 'true';

const client = new LexModelsV2Client({ region: REGION });

// ─── Retry Helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  delayMs = 1500,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isThrottled = err?.name === 'ThrottlingException' ||
                          err?.name === 'ProvisionedThroughputExceededException';
      if (attempt === maxAttempts || !isThrottled) throw err;
      console.warn(`  ⚠ Throttled on [${label}], retry ${attempt}/${maxAttempts} after ${delayMs}ms`);
      await sleep(delayMs * attempt);
    }
  }
  throw new Error(`Max retries exceeded for ${label}`);
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Slot Type Upsert ─────────────────────────────────────────────────────────

async function listExistingSlotTypes(): Promise<Map<string, string>> {
  const existing = new Map<string, string>(); // name → slotTypeId
  let nextToken: string | undefined;

  do {
    const resp = await withRetry(
      () => client.send(new ListSlotTypesCommand({
        botId: BOT_ID,
        botVersion: BOT_VERSION,
        localeId: LOCALE_ID,
        maxResults: 100,
        nextToken,
      })),
      'ListSlotTypes',
    );
    for (const st of resp.slotTypeSummaries ?? []) {
      if (st.slotTypeName && st.slotTypeId) {
        existing.set(st.slotTypeName, st.slotTypeId);
      }
    }
    nextToken = resp.nextToken;
  } while (nextToken);

  return existing;
}

function buildSlotTypeValues(def: CustomSlotTypeDefinition): SlotTypeValue[] {
  return def.values.map(v => ({
    sampleValue: { value: v.value },
    synonyms: v.synonyms?.map(s => ({ value: s })) ?? [],
  }));
}

const valueSelectionSetting = (strategy: 'ORIGINAL_VALUE' | 'TOP_RESOLUTION'): SlotValueSelectionSetting => ({
  resolutionStrategy: strategy === 'ORIGINAL_VALUE' ? 'OriginalValue' : 'TopResolution',
});

async function upsertSlotType(
  def: CustomSlotTypeDefinition,
  existingMap: Map<string, string>,
  result: BotBuildResult,
): Promise<string> {
  const values = buildSlotTypeValues(def);
  const existingId = existingMap.get(def.name);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would ${existingId ? 'update' : 'create'} slot type: ${def.name}`);
    return existingId ?? 'DRY_RUN_ID';
  }

  if (existingId) {
    await withRetry(
      () => client.send(new UpdateSlotTypeCommand({
        botId: BOT_ID,
        botVersion: BOT_VERSION,
        localeId: LOCALE_ID,
        slotTypeId: existingId,
        slotTypeName: def.name,
        description: def.description,
        slotTypeValues: values,
        valueSelectionSetting: valueSelectionSetting(def.resolutionStrategy),
      })),
      `UpdateSlotType:${def.name}`,
    );
    result.slotTypesUpdated.push(def.name);
    return existingId;
  } else {
    const resp = await withRetry(
      () => client.send(new CreateSlotTypeCommand({
        botId: BOT_ID,
        botVersion: BOT_VERSION,
        localeId: LOCALE_ID,
        slotTypeName: def.name,
        description: def.description,
        slotTypeValues: values,
        valueSelectionSetting: valueSelectionSetting(def.resolutionStrategy),
      })),
      `CreateSlotType:${def.name}`,
    );
    result.slotTypesCreated.push(def.name);
    return resp.slotTypeId!;
  }
}

// ─── Intent Upsert ────────────────────────────────────────────────────────────

async function listExistingIntents(): Promise<Map<string, string>> {
  const existing = new Map<string, string>(); // name → intentId
  let nextToken: string | undefined;

  do {
    const resp = await withRetry(
      () => client.send(new ListIntentsCommand({
        botId: BOT_ID,
        botVersion: BOT_VERSION,
        localeId: LOCALE_ID,
        maxResults: 100,
        nextToken,
      })),
      'ListIntents',
    );
    for (const intent of resp.intentSummaries ?? []) {
      if (intent.intentName && intent.intentId) {
        existing.set(intent.intentName, intent.intentId);
      }
    }
    nextToken = resp.nextToken;
  } while (nextToken);

  return existing;
}

function buildSampleUtterances(utterances: string[]): SampleUtterance[] {
  return utterances.map(u => ({ utterance: u }));
}

async function upsertIntent(
  def: IntentDefinition,
  existingMap: Map<string, string>,
  slotTypeIdMap: Map<string, string>,
  result: BotBuildResult,
): Promise<string> {
  if (INTENT_FILTER && !INTENT_FILTER.has(def.name)) return '';

  const utterances = buildSampleUtterances(def.sampleUtterances);
  const existingId = existingMap.get(def.name);

  const dialogCodeHook: DialogCodeHookSettings = { enabled: true };
  const fulfillmentCodeHook: FulfillmentCodeHookSettings = {
    enabled: true,
    postFulfillmentStatusSpecification: {
      successResponse: {
        messageGroups: [{
          message: {
            plainTextMessage: { value: def.fulfillmentMessage },
          },
        }],
        allowInterrupt: false,
      },
      failureResponse: {
        messageGroups: [{
          message: {
            plainTextMessage: {
              value: 'I was unable to submit your request. Please hold while I transfer you to a 311 operator.',
            },
          },
        }],
        allowInterrupt: false,
      },
    },
  };

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would ${existingId ? 'update' : 'create'} intent: ${def.name} (${def.slots.length} slots)`);
    return existingId ?? 'DRY_RUN_INTENT_ID';
  }

  let intentId: string;

  if (existingId) {
    await withRetry(
      () => client.send(new UpdateIntentCommand({
        botId: BOT_ID,
        botVersion: BOT_VERSION,
        localeId: LOCALE_ID,
        intentId: existingId,
        intentName: def.name,
        intentDisplayName: def.displayName,
        description: def.description,
        sampleUtterances: utterances,
        dialogCodeHook,
        fulfillmentCodeHook,
        ...(def.confirmationPrompt ? {
          intentConfirmationSetting: {
            promptSpecification: {
              maxRetries: 2,
              messageGroups: [{
                message: { plainTextMessage: { value: def.confirmationPrompt } },
              }],
            },
            declinationResponse: {
              messageGroups: [{
                message: { plainTextMessage: { value: 'No problem. Is there anything else I can help you with?' } },
              }],
            },
          },
        } : {}),
      })),
      `UpdateIntent:${def.name}`,
    );
    intentId = existingId;
    result.intentsUpdated.push(def.name);
  } else {
    const resp = await withRetry(
      () => client.send(new CreateIntentCommand({
        botId: BOT_ID,
        botVersion: BOT_VERSION,
        localeId: LOCALE_ID,
        intentName: def.name,
        intentDisplayName: def.displayName,
        description: def.description,
        sampleUtterances: utterances,
        dialogCodeHook,
        fulfillmentCodeHook,
        ...(def.confirmationPrompt ? {
          intentConfirmationSetting: {
            promptSpecification: {
              maxRetries: 2,
              messageGroups: [{
                message: { plainTextMessage: { value: def.confirmationPrompt } },
              }],
            },
            declinationResponse: {
              messageGroups: [{
                message: { plainTextMessage: { value: 'No problem. Is there anything else I can help you with?' } },
              }],
            },
          },
        } : {}),
      })),
      `CreateIntent:${def.name}`,
    );
    intentId = resp.intentId!;
    result.intentsCreated.push(def.name);
  }

  // Build slots for this intent
  if (def.slots.length > 0) {
    await upsertSlotsForIntent(def, intentId, slotTypeIdMap, result);
  }

  return intentId;
}

// ─── Slot Upsert ──────────────────────────────────────────────────────────────

/**
 * Resolves the Lex slot type ID for a slot.
 * Built-in types (AMAZON.*) are referenced by name; custom types need the ID.
 */
function resolveSlotTypeRef(
  slotTypeName: string,
  slotTypeIdMap: Map<string, string>,
): { builtInSlotTypeSignature?: string; slotTypeId?: string } {
  if (slotTypeName.startsWith('AMAZON.')) {
    // Lex V2 has no AMAZON.Address; FreeFormInput covers intersections/landmarks.
    const builtIn = slotTypeName === 'AMAZON.Address' ? 'AMAZON.FreeFormInput' : slotTypeName;
    return { slotTypeId: builtIn };
  }
  const id = slotTypeIdMap.get(slotTypeName);
  if (!id) throw new Error(`Slot type ID not found for: ${slotTypeName}. Ensure it was created first.`);
  return { slotTypeId: id };
}

async function listExistingSlots(intentId: string): Promise<Map<string, string>> {
  const existing = new Map<string, string>(); // name → slotId
  let nextToken: string | undefined;

  do {
    const resp = await withRetry(
      () => client.send(new ListSlotsCommand({
        botId: BOT_ID,
        botVersion: BOT_VERSION,
        localeId: LOCALE_ID,
        intentId,
        maxResults: 100,
        nextToken,
      })),
      `ListSlots:${intentId}`,
    );
    for (const slot of resp.slotSummaries ?? []) {
      if (slot.slotName && slot.slotId) {
        existing.set(slot.slotName, slot.slotId);
      }
    }
    nextToken = resp.nextToken;
  } while (nextToken);

  return existing;
}

async function upsertSlotsForIntent(
  intentDef: IntentDefinition,
  intentId: string,
  slotTypeIdMap: Map<string, string>,
  result: BotBuildResult,
): Promise<void> {
  const existingSlots = await listExistingSlots(intentId);
  const slotIds: Record<string, string> = {};

  for (const slotDef of intentDef.slots) {
    const slotTypeRef = resolveSlotTypeRef(slotDef.slotTypeName, slotTypeIdMap);

    const valueElicitationSetting = {
      slotConstraint: (slotDef.isRequired ? 'Required' : 'Optional') as 'Required' | 'Optional',
      promptSpecification: {
        maxRetries: 3,
        messageGroups: [
          {
            message: { plainTextMessage: { value: slotDef.elicitationPrompt } },
            variations: slotDef.clarificationPrompts.map(p => ({
              plainTextMessage: { value: p },
            })),
          },
        ],
        allowInterrupt: true,
      },
    };

    const existingSlotId = existingSlots.get(slotDef.name);

    let slotId: string;

    if (existingSlotId) {
      await withRetry(
        () => client.send(new UpdateSlotCommand({
          botId: BOT_ID,
          botVersion: BOT_VERSION,
          localeId: LOCALE_ID,
          intentId,
          slotId: existingSlotId,
          slotName: slotDef.name,
          description: slotDef.description,
          ...slotTypeRef,
          valueElicitationSetting,
        })),
        `UpdateSlot:${intentDef.name}/${slotDef.name}`,
      );
      slotId = existingSlotId;
    } else {
      const resp = await withRetry(
        () => client.send(new CreateSlotCommand({
          botId: BOT_ID,
          botVersion: BOT_VERSION,
          localeId: LOCALE_ID,
          intentId,
          slotName: slotDef.name,
          description: slotDef.description,
          ...slotTypeRef,
          valueElicitationSetting,
        })),
        `CreateSlot:${intentDef.name}/${slotDef.name}`,
      );
      slotId = resp.slotId!;
    }
    slotIds[slotDef.name] = slotId;

    await sleep(200); // Rate limit guard between slot creates
  }

  const desiredNames = new Set(intentDef.slots.map((s) => s.name));
  for (const [slotName, leftoverSlotId] of existingSlots) {
    if (desiredNames.has(slotName)) continue;
    await withRetry(
      () => client.send(new DeleteSlotCommand({
        botId: BOT_ID,
        botVersion: BOT_VERSION,
        localeId: LOCALE_ID,
        intentId,
        slotId: leftoverSlotId,
      })),
      `DeleteSlot:${intentDef.name}/${slotName}`,
    );
    await sleep(200);
  }

  // Set slot priorities on the intent (requires a final UpdateIntent call)
  const slotPriorities: SlotPriority[] = intentDef.slots
    .sort((a, b) => a.priority - b.priority)
    .map((slotDef, idx) => ({
      priority: idx + 1,
      slotId: slotIds[slotDef.name],
    }))
    .filter(sp => sp.slotId); // guard against missing IDs

  if (slotPriorities.length > 0 && !DRY_RUN) {
    await withRetry(
      () => client.send(new UpdateIntentCommand({
        botId: BOT_ID,
        botVersion: BOT_VERSION,
        localeId: LOCALE_ID,
        intentId,
        intentName: intentDef.name,
        intentDisplayName: intentDef.displayName,
        description: intentDef.description,
        sampleUtterances: buildSampleUtterances(intentDef.sampleUtterances),
        slotPriorities,
        dialogCodeHook: { enabled: true },
        fulfillmentCodeHook: { enabled: true },
      })),
      `SetSlotPriorities:${intentDef.name}`,
    );
  }
}

// ─── Build Trigger ────────────────────────────────────────────────────────────

async function triggerBotBuild(): Promise<void> {
  if (DRY_RUN) {
    console.log('  [DRY RUN] Would trigger BuildBotLocale');
    return;
  }
  await withRetry(
    () => client.send(new BuildBotLocaleCommand({
      botId: BOT_ID,
      botVersion: BOT_VERSION,
      localeId: LOCALE_ID,
    })),
    'BuildBotLocale',
  );
  console.log('  ✓ Bot locale build triggered — bot will be available once build completes');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const startMs = Date.now();
  console.log(`\n🚀 Call Assist Lex Bot Builder`);
  console.log(`   Bot ID:  ${BOT_ID}`);
  console.log(`   Locale:  ${LOCALE_ID}`);
  console.log(`   Region:  ${REGION}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  if (INTENT_FILTER) console.log(`   Filter:  ${[...INTENT_FILTER].join(', ')}`);
  if (SLOT_TYPES_ONLY) console.log(`   Mode:    SLOT_TYPES_ONLY`);
  console.log('');

  const result: BotBuildResult = {
    botId: BOT_ID,
    botVersion: BOT_VERSION,
    localeId: LOCALE_ID,
    intentCount: 0,
    slotTypeCount: 0,
    intentsCreated: [],
    intentsUpdated: [],
    slotTypesCreated: [],
    slotTypesUpdated: [],
    errors: [],
    durationMs: 0,
  };

  // ── Step 1: Slot Types ─────────────────────────────────────────────────────
  console.log(`📦 Building ${ALL_SLOT_TYPES.length} slot types...`);
  const existingSlotTypes = await listExistingSlotTypes();
  const slotTypeIdMap = new Map<string, string>();

  for (const slotTypeDef of ALL_SLOT_TYPES) {
    try {
      const id = await upsertSlotType(slotTypeDef, existingSlotTypes, result);
      slotTypeIdMap.set(slotTypeDef.name, id);
      console.log(`  ✓ ${slotTypeDef.name} (${slotTypeDef.values.length} values)`);
      await sleep(300); // Throttle guard
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      result.errors.push({ resource: `SlotType:${slotTypeDef.name}`, error: msg });
      console.error(`  ✗ ${slotTypeDef.name}: ${msg}`);
    }
  }

  result.slotTypeCount = result.slotTypesCreated.length + result.slotTypesUpdated.length;

  if (SLOT_TYPES_ONLY) {
    console.log('\n⏩ SLOT_TYPES_ONLY — skipping intent upserts');
    console.log('\n🔨 Triggering bot locale build...');
    try {
      await triggerBotBuild();
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      result.errors.push({ resource: 'BuildBotLocale', error: msg });
      console.error(`  ✗ Build trigger failed: ${msg}`);
    }
    result.durationMs = Date.now() - startMs;
    console.log('\n─────────────────────────────────────────');
    console.log(`✅ Slot-types-only complete in ${(result.durationMs / 1000).toFixed(1)}s`);
    console.log(`   Slot types created: ${result.slotTypesCreated.length}`);
    console.log(`   Slot types updated: ${result.slotTypesUpdated.length}`);
    if (result.errors.length > 0) {
      console.log(`   Errors:             ${result.errors.length}`);
      result.errors.forEach(e => console.error(`     ✗ ${e.resource}: ${e.error}`));
    }
    console.log('─────────────────────────────────────────\n');
    return;
  }

  // ── Step 2: Intents ────────────────────────────────────────────────────────
  const SKIP = new Set(['TransferToLiveAgent', 'RedirectToEmergencyServices']);
  const intentsToProcess = (INTENT_FILTER
    ? INTENTS.filter(i => INTENT_FILTER.has(i.name))
    : INTENTS).filter(i => !SKIP.has(i.name));

  console.log(`\n🎯 Building ${intentsToProcess.length} intents...`);
  const existingIntents = await listExistingIntents();

  for (const intentDef of intentsToProcess) {
    try {
      await upsertIntent(intentDef, existingIntents, slotTypeIdMap, result);
      const action = existingIntents.has(intentDef.name) ? 'updated' : 'created';
      console.log(`  ✓ ${intentDef.name} [${action}] — ${intentDef.slots.length} slots, ${intentDef.sampleUtterances.length} utterances`);
      await sleep(400); // Throttle guard between intents
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      result.errors.push({ resource: `Intent:${intentDef.name}`, error: msg });
      console.error(`  ✗ ${intentDef.name}: ${msg}`);
    }
  }

  result.intentCount = result.intentsCreated.length + result.intentsUpdated.length;

  // ── Step 2b: Merge TransferToLiveAgent catch-alls onto RequestHuman ─────────
  // TransferToLiveAgent is not created on the bot (RequestHuman already owns that path).
  // Still push exhaustive "talk to a human / not listed" phrases so Fallback never traps callers.
  const transferDef = INTENTS.find((i) => i.name === 'TransferToLiveAgent');
  const requestHumanId = existingIntents.get('RequestHuman');
  if (transferDef && requestHumanId && !DRY_RUN && (!INTENT_FILTER || INTENT_FILTER.has('TransferToLiveAgent') || INTENT_FILTER.has('RequestHuman'))) {
    try {
      const current = await withRetry(
        () => client.send(new DescribeIntentCommand({
          botId: BOT_ID,
          botVersion: BOT_VERSION,
          localeId: LOCALE_ID,
          intentId: requestHumanId,
        })),
        'DescribeIntent:RequestHuman',
      );
      const seen = new Set(
        (current.sampleUtterances ?? [])
          .map((u) => (u.utterance ?? '').trim().toLowerCase())
          .filter(Boolean),
      );
      const merged = [...(current.sampleUtterances ?? [])];
      for (const u of transferDef.sampleUtterances) {
        const key = u.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        merged.push({ utterance: u.trim() });
      }
      await withRetry(
        () => client.send(new UpdateIntentCommand({
          botId: BOT_ID,
          botVersion: BOT_VERSION,
          localeId: LOCALE_ID,
          intentId: requestHumanId,
          intentName: 'RequestHuman',
          description: current.description,
          sampleUtterances: merged,
          dialogCodeHook: current.dialogCodeHook,
          fulfillmentCodeHook: current.fulfillmentCodeHook,
          slotPriorities: current.slotPriorities,
          intentConfirmationSetting: current.intentConfirmationSetting,
        })),
        'UpdateIntent:RequestHuman',
      );
      console.log(`\n🧑 RequestHuman catch-alls updated — ${merged.length} utterances`);
      result.intentsUpdated.push('RequestHuman');
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      result.errors.push({ resource: 'Intent:RequestHuman', error: msg });
      console.error(`  ✗ RequestHuman catch-alls: ${msg}`);
    }
  }

  // ── Step 3: Trigger Build ──────────────────────────────────────────────────
  console.log('\n🔨 Triggering bot locale build...');
  try {
    await triggerBotBuild();
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    result.errors.push({ resource: 'BuildBotLocale', error: msg });
    console.error(`  ✗ Build trigger failed: ${msg}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  result.durationMs = Date.now() - startMs;

  console.log('\n─────────────────────────────────────────');
  console.log(`✅ Build complete in ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`   Slot types created: ${result.slotTypesCreated.length}`);
  console.log(`   Slot types updated: ${result.slotTypesUpdated.length}`);
  console.log(`   Intents created:    ${result.intentsCreated.length}`);
  console.log(`   Intents updated:    ${result.intentsUpdated.length}`);
  if (result.errors.length > 0) {
    console.log(`   Errors:             ${result.errors.length}`);
    result.errors.forEach(e => console.error(`     ✗ ${e.resource}: ${e.error}`));
  }
  console.log('─────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
