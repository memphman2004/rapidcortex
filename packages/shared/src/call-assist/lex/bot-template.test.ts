import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertBotTemplateHasNoAgencyCopy,
  BOT_TEMPLATE_INTENT_NAMES,
  intentsFromCanonicalSpec,
  type CanonicalBotSpec,
} from "./bot-template.js";
import { estimatedLexBotRebuildMinutes, isLexBotQuotaBlocking } from "./provisioning-types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("Call Assist universal bot template", () => {
  it("maps all 20 canonical intents and contains no agency copy", () => {
    const spec = JSON.parse(readFileSync(join(repoRoot, "infra/lex/bot-spec.json"), "utf8")) as CanonicalBotSpec;
    const intents = intentsFromCanonicalSpec(spec);
    expect(intents).toHaveLength(20);
    expect(intents.map((intent) => intent.intentName)).toEqual([...BOT_TEMPLATE_INTENT_NAMES]);
    expect(assertBotTemplateHasNoAgencyCopy(intents)).toEqual([]);
  });

  it("blocks quota at limit minus 5 and estimates 5 minutes per rolling rebuild", () => {
    expect(isLexBotQuotaBlocking(94, 100)).toBe(false);
    expect(isLexBotQuotaBlocking(95, 100)).toBe(true);
    expect(estimatedLexBotRebuildMinutes(100)).toBe(500);
  });
});
