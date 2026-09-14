import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assertBotTemplateHasNoAgencyCopy,
  BOT_TEMPLATE_INTENT_NAMES,
  intentsFromCanonicalSpec,
  mergeLexLocaleCopy,
  type CanonicalBotSpec,
  type LexLocaleCopyFile,
} from "./bot-template.js";
import {
  CALL_ASSIST_911_LANGUAGE_PACK,
  estimatedLexBotRebuildMinutes,
  isLexBotQuotaBlocking,
} from "./provisioning-types.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

function loadMergedSpec(): CanonicalBotSpec {
  const spec = JSON.parse(readFileSync(join(repoRoot, "infra/lex/bot-spec.json"), "utf8")) as CanonicalBotSpec;
  const copy = JSON.parse(readFileSync(join(repoRoot, "infra/lex/locale-copy.json"), "utf8")) as LexLocaleCopyFile;
  return mergeLexLocaleCopy(spec, copy);
}

describe("Call Assist universal bot template", () => {
  it("maps all 20 canonical intents and contains no agency copy", () => {
    const spec = loadMergedSpec();
    const intents = intentsFromCanonicalSpec(spec);
    expect(intents).toHaveLength(20);
    expect(intents.map((intent) => intent.intentName).sort()).toEqual([...BOT_TEMPLATE_INTENT_NAMES].sort());
    expect(assertBotTemplateHasNoAgencyCopy(intents)).toEqual([]);
  });

  it("includes 911 language-pack locales with utterances and slot prompts", () => {
    const spec = loadMergedSpec();
    expect(spec.locales).toEqual(expect.arrayContaining(["en_US", "es_US", ...CALL_ASSIST_911_LANGUAGE_PACK]));
    const noise = spec.intents.find((intent) => intent.name === "NoiseComplaint");
    expect(noise?.utterancesZhCn?.length).toBeGreaterThan(0);
    expect(noise?.utterancesZhHk?.length).toBeGreaterThan(0);
    expect(noise?.utterancesTl?.length).toBeGreaterThan(0);
    expect(noise?.utterancesVi?.length).toBeGreaterThan(0);
    expect(noise?.utterancesAr?.length).toBeGreaterThan(0);
    const location = noise?.slots?.find((slot) => slot.name === "NoiseLocation");
    expect(location?.promptZhCn).toBeTruthy();
    expect(location?.promptAr).toBeTruthy();
    const emergency = spec.intents.find((intent) => intent.name === "EmergencyEscalation");
    expect(emergency?.utterancesZhCn).toEqual(expect.arrayContaining(["救命"]));
    expect(emergency?.utterancesTl).toEqual(expect.arrayContaining(["tulong"]));
  });

  it("blocks quota at limit minus 5 and estimates 5 minutes per rolling rebuild", () => {
    expect(isLexBotQuotaBlocking(94, 100)).toBe(false);
    expect(isLexBotQuotaBlocking(95, 100)).toBe(true);
    expect(estimatedLexBotRebuildMinutes(100)).toBe(500);
  });
});
