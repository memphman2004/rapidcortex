#!/usr/bin/env python3
"""Sync infra/lex/bot-spec.json onto Lex V2 DRAFT locales. Does not update live-* aliases."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT / "infra" / "lex" / "bot-spec.json").read_text(encoding="utf-8"))
BOT_ID = "IJIBJOJG2L"
REGION = "us-east-1"
NO_CONFIRM = {
    "EmergencyEscalation",
    "RequestHuman",
    "PublicWorksIssue",
    "OnlineReportEligibility",
    "RepeatCallCheck",
    "InformationRequest",
    "FallbackIntent",
}
DECLINE = {
    "en_US": "I'm sorry about that. Let me start over. What would you like to correct?",
    "es_US": "Disculpe. Empecemos de nuevo. ¿Qué quisiera corregir?",
}
VOICES = {"en_US": "Ruth", "es_US": "Lupe"}

SLOT_TYPES = [
    ("FreeText", "OriginalValue", [("unknown", []), ("none", [])]),
    ("LocationAddress", "OriginalValue", [("address", []), ("intersection", []), ("landmark", [])]),
    (
        "VehicleColor",
        "TopResolution",
        [
            ("Red", ["red", "crimson", "maroon", "dark red", "bright red"]),
            ("Blue", ["blue", "navy", "dark blue", "light blue", "sky blue", "royal blue"]),
            ("Black", ["black", "dark", "jet black"]),
            ("White", ["white", "cream", "off-white", "pearl"]),
            ("Silver", ["silver", "gray", "grey", "metallic"]),
            ("Green", ["green", "olive", "dark green", "forest green"]),
            ("Gold", ["gold", "tan", "beige", "champagne"]),
            ("Brown", ["brown", "bronze", "copper", "rust"]),
        ],
    ),
    (
        "VehicleType",
        "TopResolution",
        [
            ("car", ["sedan", "coupe", "convertible"]),
            ("truck", ["pickup", "pickup truck"]),
            ("SUV", ["crossover", "van", "minivan"]),
            ("motorcycle", ["bike", "moped", "scooter"]),
            ("semi", ["eighteen-wheeler", "box truck", "delivery truck"]),
        ],
    ),
    (
        "IncidentTimeframe",
        "TopResolution",
        [
            ("right now", ["happening now", "currently", "still going on"]),
            ("just happened", ["a few minutes ago", "minutes ago", "just now"]),
            ("earlier today", ["about an hour ago", "this morning", "this afternoon", "tonight"]),
            ("yesterday", ["last night", "a while ago"]),
            ("not sure", ["I don't know", "unknown"]),
        ],
    ),
    (
        "NoiseType",
        "OriginalValue",
        [(v, []) for v in ("music", "yelling", "party", "fireworks", "barking", "engine", "alarm", "other")],
    ),
    (
        "ParkingViolationType",
        "OriginalValue",
        [(v, []) for v in ("driveway", "fire hydrant", "handicap", "no parking", "fire lane", "sidewalk", "other")],
    ),
    (
        "AnimalThreatLevel",
        "TopResolution",
        [
            ("aggressive", ["attacking", "vicious", "biting"]),
            ("injured", []),
            ("stray", ["loose"]),
            ("cruelty", ["neglect"]),
            ("nuisance", []),
        ],
    ),
    (
        "YesNoConfirmation",
        "TopResolution",
        [
            ("Yes", ["yes", "yeah", "yep", "y", "true", "sí", "si", "affirmative"]),
            ("No", ["no", "nope", "n", "false", "negative"]),
        ],
    ),
]


def client():
    return boto3.client("lexv2-models", region_name=REGION)


def wait_locale_gone(lex, locale: str) -> None:
    for _ in range(40):
        try:
            lex.describe_bot_locale(botId=BOT_ID, botVersion="DRAFT", localeId=locale)
        except ClientError as exc:
            if exc.response["Error"]["Code"] in {"ResourceNotFoundException", "NotFoundException"}:
                return
            raise
        time.sleep(3)
    raise TimeoutError(f"{locale} did not delete")


def wait_locale_status(lex, locale: str, wanted: str) -> str:
    last = ""
    for _ in range(80):
        desc = lex.describe_bot_locale(botId=BOT_ID, botVersion="DRAFT", localeId=locale)
        last = desc["botLocaleStatus"]
        print(f"   {locale}={last}", flush=True)
        if last == wanted:
            return last
        if last == "Failed":
            raise RuntimeError(desc.get("failureReasons") or last)
        time.sleep(8)
    raise TimeoutError(f"{locale} never reached {wanted} (last={last})")


def recreate_locale(lex, locale: str) -> None:
    try:
        lex.delete_bot_locale(botId=BOT_ID, botVersion="DRAFT", localeId=locale)
        print(f"→ deleted DRAFT locale {locale}", flush=True)
        wait_locale_gone(lex, locale)
    except ClientError as exc:
        if exc.response["Error"]["Code"] not in {"ResourceNotFoundException", "NotFoundException"}:
            raise
    lex.create_bot_locale(
        botId=BOT_ID,
        botVersion="DRAFT",
        localeId=locale,
        nluIntentConfidenceThreshold=0.7,
        voiceSettings={"voiceId": VOICES[locale], "engine": "neural"},
        description="Call Assist locale from lex-bot-complete-spec",
    )
    print(f"→ created locale {locale}", flush=True)
    wait_locale_status(lex, locale, "NotBuilt")


def create_slot_types(lex, locale: str) -> dict[str, str]:
    ids: dict[str, str] = {}
    for name, strategy, values in SLOT_TYPES:
        slot_values = []
        for value, synonyms in values:
            item = {"sampleValue": {"value": value}}
            if synonyms:
                item["synonyms"] = [{"value": s} for s in synonyms]
            slot_values.append(item)
        resp = lex.create_slot_type(
            botId=BOT_ID,
            botVersion="DRAFT",
            localeId=locale,
            slotTypeName=name,
            slotTypeValues=slot_values,
            valueSelectionSetting={"resolutionStrategy": strategy},
            description=name,
        )
        ids[name] = resp["slotTypeId"]
        print(f"   slot type {name}={resp['slotTypeId']}", flush=True)
    return ids


def prompt_spec(text: str, ssml: bool = False) -> dict:
    message = {"ssmlMessage": {"value": text}} if ssml else {"plainTextMessage": {"value": text}}
    return {
        "messageGroups": [{"message": message}],
        "maxRetries": 2,
        "allowInterrupt": True,
    }


def create_intents(lex, locale: str, type_ids: dict[str, str]) -> None:
    for priority, intent in enumerate(SPEC["intents"], start=1):
        name = intent["name"]
        utterances = intent["utterancesEn"] if locale == "en_US" else intent["utterancesEs"]
        kwargs: dict = {
            "botId": BOT_ID,
            "botVersion": "DRAFT",
            "localeId": locale,
            "intentName": name,
            "description": f"Call Assist {name}",
            "dialogCodeHook": {"enabled": True},
            "fulfillmentCodeHook": {"enabled": True, "active": True},
        }
        if name == "FallbackIntent":
            kwargs["parentIntentSignature"] = "AMAZON.FallbackIntent"
        elif utterances:
            kwargs["sampleUtterances"] = [{"utterance": u} for u in utterances]
        confirm = intent["confirmationEn"] if locale == "en_US" else (intent["confirmationEs"] or intent["confirmationEn"])
        if confirm and name not in NO_CONFIRM:
            ssml = confirm if confirm.strip().startswith("<speak>") else f"<speak>{confirm}</speak>"
            decline = DECLINE[locale]
            kwargs["intentConfirmationSetting"] = {
                "promptSpecification": prompt_spec(ssml, ssml=True),
                "declinationResponse": {
                    "messageGroups": [{"message": {"plainTextMessage": {"value": decline}}}],
                },
                "active": True,
            }
        try:
            resp = lex.create_intent(**kwargs)
        except ClientError as exc:
            # FallbackIntent already exists on a new locale
            if name == "FallbackIntent":
                listed = lex.list_intents(botId=BOT_ID, botVersion="DRAFT", localeId=locale)
                fallback = next(i for i in listed["intentSummaries"] if i["intentName"] == "FallbackIntent")
                lex.update_intent(
                    botId=BOT_ID,
                    botVersion="DRAFT",
                    localeId=locale,
                    intentId=fallback["intentId"],
                    intentName="FallbackIntent",
                    parentIntentSignature="AMAZON.FallbackIntent",
                    dialogCodeHook={"enabled": True},
                    fulfillmentCodeHook={"enabled": True, "active": True},
                )
                print(f"   intent {name} (updated fallback)", flush=True)
                continue
            raise
        intent_id = resp["intentId"]
        print(f"   intent {name}={intent_id} priority={priority}", flush=True)
        slot_ids = []
        for index, slot in enumerate(intent["slots"], start=1):
            slot_type = slot["slotType"]
            slot_type_id = type_ids.get(slot_type, slot_type)
            prompt = slot["promptEn"] if locale == "en_US" else slot["promptEs"]
            created_slot = lex.create_slot(
                botId=BOT_ID,
                botVersion="DRAFT",
                localeId=locale,
                intentId=intent_id,
                slotName=slot["name"],
                slotTypeId=slot_type_id,
                valueElicitationSetting={
                    "slotConstraint": "Required" if slot["required"] else "Optional",
                    "promptSpecification": prompt_spec(prompt),
                },
                description=slot["name"],
            )
            slot_ids.append(created_slot["slotId"])
            print(f"      slot {slot['name']}={created_slot['slotId']}", flush=True)
        if intent["slots"]:
            lex.update_intent(
                botId=BOT_ID,
                botVersion="DRAFT",
                localeId=locale,
                intentId=intent_id,
                intentName=name,
                description=f"Call Assist {name}",
                sampleUtterances=[{"utterance": u} for u in utterances] if utterances else [],
                dialogCodeHook={"enabled": True},
                fulfillmentCodeHook={"enabled": True, "active": True},
                slotPriorities=[
                    {"priority": i, "slotId": slot_id} for i, slot_id in enumerate(slot_ids, start=1)
                ],
                **(
                    {
                        "intentConfirmationSetting": kwargs["intentConfirmationSetting"],
                    }
                    if "intentConfirmationSetting" in kwargs
                    else {}
                ),
            )


def main() -> int:
    lex = client()
    locales = sys.argv[1:] or list(SPEC["locales"])
    for locale in locales:
        print(f"== {locale} ==", flush=True)
        recreate_locale(lex, locale)
        type_ids = create_slot_types(lex, locale)
        create_intents(lex, locale, type_ids)
        lex.build_bot_locale(botId=BOT_ID, botVersion="DRAFT", localeId=locale)
        print(f"→ building {locale}", flush=True)
        wait_locale_status(lex, locale, "Built")
    print("Locales submitted for build. Poll with describe-bot-locale. Alias live-dev is unchanged.")
    print("Test: aws lexv2-runtime recognize-text --bot-id IJIBJOJG2L --bot-alias-id TSTALIASID --locale-id en_US --session-id smoke-1 --text \"noise complaint\"")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
