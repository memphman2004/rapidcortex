#!/usr/bin/env python3
"""Generate stack-lex.yaml BotLocales + lex-spec-slots.ts from infra/lex/bot-spec.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC_JSON = ROOT / "infra" / "lex" / "bot-spec.json"
STACK = ROOT / "infra" / "nested" / "stack-lex.yaml"
SLOTS_TS = ROOT / "apps" / "api" / "src" / "call-assist" / "lex" / "lex-spec-slots.ts"
UTTERANCES_TS = ROOT / "apps" / "api" / "src" / "call-assist" / "lex" / "utterances" / "911.ts"

DECLINE_EN = "I'm sorry about that. Let me start over. What would you like to correct?"
DECLINE_ES = "Disculpe. Empecemos de nuevo. ¿Qué quisiera corregir?"

NO_CONFIRM = {
    "EmergencyEscalation",
    "RequestHuman",
    "PublicWorksIssue",
    "OnlineReportEligibility",
    "RepeatCallCheck",
    "InformationRequest",
    "Welcome",
    "FallbackIntent",
}

SLOT_TYPE_YAML = """\
          SlotTypes:
            - Name: FreeText
              Description: Original caller phrasing (location, vehicle, descriptions)
              SlotTypeValues:
                - SampleValue:
                    Value: unknown
                - SampleValue:
                    Value: none
              ValueSelectionSetting:
                ResolutionStrategy: ORIGINAL_VALUE
            - Name: LocationAddress
              Description: Address, intersection, landmark, or business name
              SlotTypeValues:
                - SampleValue:
                    Value: address
                - SampleValue:
                    Value: intersection
                - SampleValue:
                    Value: landmark
              ValueSelectionSetting:
                ResolutionStrategy: ORIGINAL_VALUE
            - Name: VehicleColor
              Description: Vehicle color with synonyms
              SlotTypeValues:
                - SampleValue:
                    Value: Red
                  Synonyms:
                    - Value: red
                    - Value: crimson
                    - Value: maroon
                    - Value: dark red
                    - Value: bright red
                - SampleValue:
                    Value: Blue
                  Synonyms:
                    - Value: blue
                    - Value: navy
                    - Value: dark blue
                    - Value: light blue
                    - Value: sky blue
                    - Value: royal blue
                - SampleValue:
                    Value: Black
                  Synonyms:
                    - Value: black
                    - Value: dark
                    - Value: jet black
                - SampleValue:
                    Value: White
                  Synonyms:
                    - Value: white
                    - Value: cream
                    - Value: off-white
                    - Value: pearl
                - SampleValue:
                    Value: Silver
                  Synonyms:
                    - Value: silver
                    - Value: gray
                    - Value: grey
                    - Value: metallic
                - SampleValue:
                    Value: Green
                  Synonyms:
                    - Value: green
                    - Value: olive
                    - Value: dark green
                    - Value: forest green
                - SampleValue:
                    Value: Gold
                  Synonyms:
                    - Value: gold
                    - Value: tan
                    - Value: beige
                    - Value: champagne
                - SampleValue:
                    Value: Brown
                  Synonyms:
                    - Value: brown
                    - Value: bronze
                    - Value: copper
                    - Value: rust
              ValueSelectionSetting:
                ResolutionStrategy: TOP_RESOLUTION
            - Name: VehicleType
              Description: Vehicle body type
              SlotTypeValues:
                - SampleValue:
                    Value: car
                  Synonyms:
                    - Value: sedan
                    - Value: coupe
                    - Value: convertible
                - SampleValue:
                    Value: truck
                  Synonyms:
                    - Value: pickup
                    - Value: pickup truck
                - SampleValue:
                    Value: SUV
                  Synonyms:
                    - Value: crossover
                    - Value: van
                    - Value: minivan
                - SampleValue:
                    Value: motorcycle
                  Synonyms:
                    - Value: bike
                    - Value: moped
                    - Value: scooter
                - SampleValue:
                    Value: semi
                  Synonyms:
                    - Value: eighteen-wheeler
                    - Value: box truck
                    - Value: delivery truck
              ValueSelectionSetting:
                ResolutionStrategy: TOP_RESOLUTION
            - Name: IncidentTimeframe
              Description: When the incident occurred
              SlotTypeValues:
                - SampleValue:
                    Value: right now
                  Synonyms:
                    - Value: happening now
                    - Value: currently
                    - Value: still going on
                - SampleValue:
                    Value: just happened
                  Synonyms:
                    - Value: a few minutes ago
                    - Value: minutes ago
                    - Value: just now
                - SampleValue:
                    Value: earlier today
                  Synonyms:
                    - Value: about an hour ago
                    - Value: this morning
                    - Value: this afternoon
                    - Value: tonight
                - SampleValue:
                    Value: yesterday
                  Synonyms:
                    - Value: last night
                    - Value: a while ago
                - SampleValue:
                    Value: not sure
                  Synonyms:
                    - Value: I don't know
                    - Value: unknown
              ValueSelectionSetting:
                ResolutionStrategy: TOP_RESOLUTION
            - Name: NoiseType
              Description: Kind of noise
              SlotTypeValues:
                - SampleValue:
                    Value: music
                - SampleValue:
                    Value: yelling
                - SampleValue:
                    Value: party
                - SampleValue:
                    Value: fireworks
                - SampleValue:
                    Value: barking
                - SampleValue:
                    Value: engine
                - SampleValue:
                    Value: alarm
                - SampleValue:
                    Value: other
              ValueSelectionSetting:
                ResolutionStrategy: ORIGINAL_VALUE
            - Name: ParkingViolationType
              Description: Parking violation type
              SlotTypeValues:
                - SampleValue:
                    Value: driveway
                - SampleValue:
                    Value: fire hydrant
                - SampleValue:
                    Value: handicap
                - SampleValue:
                    Value: no parking
                - SampleValue:
                    Value: fire lane
                - SampleValue:
                    Value: sidewalk
                - SampleValue:
                    Value: other
              ValueSelectionSetting:
                ResolutionStrategy: ORIGINAL_VALUE
            - Name: AnimalThreatLevel
              Description: Animal situation severity
              SlotTypeValues:
                - SampleValue:
                    Value: aggressive
                  Synonyms:
                    - Value: attacking
                    - Value: vicious
                    - Value: biting
                - SampleValue:
                    Value: injured
                - SampleValue:
                    Value: stray
                  Synonyms:
                    - Value: loose
                    - Value: loose/stray
                - SampleValue:
                    Value: cruelty
                  Synonyms:
                    - Value: neglect
                    - Value: cruelty/neglect
                - SampleValue:
                    Value: nuisance
              ValueSelectionSetting:
                ResolutionStrategy: TOP_RESOLUTION
            - Name: YesNoConfirmation
              Description: Yes/no confirmation (WeaponVisible, injuries, still happening)
              SlotTypeValues:
                - SampleValue:
                    Value: Yes
                  Synonyms:
                    - Value: yes
                    - Value: yeah
                    - Value: yep
                    - Value: "y"
                    - Value: "true"
                    - Value: "sí"
                    - Value: si
                    - Value: affirmative
                - SampleValue:
                    Value: No
                  Synonyms:
                    - Value: "no"
                    - Value: nope
                    - Value: "n"
                    - Value: "false"
                    - Value: negative
              ValueSelectionSetting:
                ResolutionStrategy: TOP_RESOLUTION
"""


def q(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def emit_intent(intent: dict, locale: str, indent: str = "            ") -> str:
    name = intent["name"]
    utterances = intent["utterancesEn"] if locale == "en_US" else intent["utterancesEs"]
    lines = [
        f"{indent}- Name: {name}",
        f"{indent}  Description: Call Assist intent {name}",
    ]
    if name == "FallbackIntent":
        lines.append(f"{indent}  ParentIntentSignature: AMAZON.FallbackIntent")
    elif utterances:
        lines.append(f"{indent}  SampleUtterances:")
        for u in utterances:
            lines.append(f"{indent}    - Utterance: {q(u)}")
    lines += [
        f"{indent}  DialogCodeHook:",
        f"{indent}    Enabled: true",
        f"{indent}  FulfillmentCodeHook:",
        f"{indent}    Enabled: true",
        f"{indent}    IsActive: true",
    ]
    confirm = intent["confirmationEn"] if locale == "en_US" else (intent["confirmationEs"] or intent["confirmationEn"])
    decline = DECLINE_EN if locale == "en_US" else DECLINE_ES
    if confirm and name not in NO_CONFIRM:
        ssml = confirm if confirm.strip().startswith("<speak>") else f"<speak>{confirm}</speak>"
        lines += [
            f"{indent}  IntentConfirmationSetting:",
            f"{indent}    IsActive: true",
            f"{indent}    PromptSpecification:",
            f"{indent}      MaxRetries: 2",
            f"{indent}      AllowInterrupt: true",
            f"{indent}      MessageGroupsList:",
            f"{indent}        - Message:",
            f"{indent}            SSMLMessage:",
            f"{indent}              Value: {q(ssml)}",
            f"{indent}    DeclinationResponse:",
            f"{indent}      MessageGroupsList:",
            f"{indent}        - Message:",
            f"{indent}            PlainTextMessage:",
            f"{indent}              Value: {q(decline)}",
        ]
    slots = intent["slots"]
    if slots:
        lines.append(f"{indent}  SlotPriorities:")
        for i, slot in enumerate(slots, start=1):
            lines.append(f"{indent}    - Priority: {i}")
            lines.append(f"{indent}      SlotName: {slot['name']}")
        lines.append(f"{indent}  Slots:")
        for slot in slots:
            prompt = slot["promptEn"] if locale == "en_US" else slot["promptEs"]
            constraint = "Required" if slot["required"] else "Optional"
            lines += [
                f"{indent}    - Name: {slot['name']}",
                f"{indent}      SlotTypeName: {slot['slotType']}",
                f"{indent}      ValueElicitationSetting:",
                f"{indent}        SlotConstraint: {constraint}",
                f"{indent}        PromptSpecification:",
                f"{indent}          MaxRetries: 2",
                f"{indent}          AllowInterrupt: true",
                f"{indent}          MessageGroupsList:",
                f"{indent}            - Message:",
                f"{indent}                PlainTextMessage:",
                f"{indent}                  Value: {q(prompt)}",
            ]
    return "\n".join(lines)


def emit_locales(spec: dict) -> str:
    chunks = ["      BotLocales:"]
    voices = {"en_US": "Ruth", "es_US": "Lupe"}
    for locale in spec["locales"]:
        chunks.append(f"        - LocaleId: {locale}")
        chunks.append("          NluConfidenceThreshold: 0.7")
        chunks.append("          VoiceSettings:")
        chunks.append(f"            VoiceId: {voices[locale]}")
        chunks.append("            Engine: neural")
        chunks.append(SLOT_TYPE_YAML.rstrip("\n"))
        chunks.append("          Intents:")
        for intent in spec["intents"]:
            chunks.append(emit_intent(intent, locale))
    return "\n".join(chunks) + "\n"


def emit_slots_ts(spec: dict) -> str:
    payload = {
        intent["name"]: [
            {
                "name": s["name"],
                "required": s["required"],
                "promptEn": s["promptEn"],
                "promptEs": s["promptEs"],
            }
            for s in intent["slots"]
        ]
        for intent in spec["intents"]
    }
    names = [intent["name"] for intent in spec["intents"]]
    location_slots = []
    callback_slots = []
    for intent in spec["intents"]:
        for slot in intent["slots"]:
            n = slot["name"]
            if "Location" in n or n.endswith("Address"):
                location_slots.append(n)
            if "Callback" in n or n == "CallbackNumber":
                callback_slots.append(n)
    location_slots = list(dict.fromkeys(["location", "building", "section", *location_slots]))
    callback_slots = list(dict.fromkeys(["callbackNumber", *callback_slots]))
    return f"""/** Generated from infra/lex/bot-spec.json — do not edit by hand. Run scripts/generate-lex-bot-locales.py */

export type LexSpecSlot = {{
  name: string;
  required: boolean;
  promptEn: string;
  promptEs: string;
}};

export const LEX_SPEC_INTENT_ORDER = {json.dumps(names, indent=2)} as const;

export const LEX_SPEC_SLOTS: Record<string, LexSpecSlot[]> = {json.dumps(payload, indent=2, ensure_ascii=False)};

export const LEX_SPEC_LOCATION_SLOT_NAMES = {json.dumps(location_slots)} as const;

export const LEX_SPEC_CALLBACK_SLOT_NAMES = {json.dumps(callback_slots)} as const;

export const LEX_SPEC_CONFIRMATION_INTENTS = new Set<string>(
  {json.dumps([i["name"] for i in spec["intents"] if i["confirmationEn"] and i["name"] not in NO_CONFIRM])},
);
"""


def emit_utterances_ts(spec: dict) -> str:
    obj = {i["name"]: i["utterancesEn"] for i in spec["intents"] if i["utterancesEn"]}
    es = {i["name"]: i["utterancesEs"] for i in spec["intents"] if i["utterancesEs"]}
    return f"""/** Generated from connect/lex-bot-complete-spec.md — both locales live in infra/lex/bot-spec.json. */

export const UTTERANCES_911 = {json.dumps(obj, indent=2, ensure_ascii=False)} as const;

export const UTTERANCES_911_ES = {json.dumps(es, indent=2, ensure_ascii=False)} as const;
"""


def patch_stack(locales_yaml: str) -> None:
    text = STACK.read_text(encoding="utf-8")
    pattern = re.compile(
        r"      BotLocales:\n.*?^(?=  RCCallAssistBotVersion:)",
        re.S | re.M,
    )
    if not pattern.search(text):
        raise SystemExit("Could not find BotLocales block in stack-lex.yaml")
    updated = pattern.sub(locales_yaml, text, count=1)
    STACK.write_text(updated, encoding="utf-8")


def main() -> None:
    spec = json.loads(SPEC_JSON.read_text(encoding="utf-8"))
    locales_yaml = emit_locales(spec)
    patch_stack(locales_yaml)
    SLOTS_TS.write_text(emit_slots_ts(spec), encoding="utf-8")
    UTTERANCES_TS.write_text(emit_utterances_ts(spec), encoding="utf-8")
    size = STACK.stat().st_size
    print(f"Updated {STACK} ({size} bytes)")
    print(f"Wrote {SLOTS_TS}")
    print(f"Wrote {UTTERANCES_TS}")


if __name__ == "__main__":
    main()
