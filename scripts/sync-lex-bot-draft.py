#!/usr/bin/env python3
"""Sync infra/lex/bot-spec.json onto Lex V2 DRAFT locales. Does not update live-* aliases."""
from __future__ import annotations

import sys
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from lex_bot_locales import (  # noqa: E402
    DECLINE,
    LIMITED_ASR_LOCALES,
    VOICES,
    confirmation_for,
    load_merged_spec,
    prompt_for,
    spec_locales,
    utterances_for,
)

SPEC = load_merged_spec(ROOT)
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
            ("Yes", ["yes", "yeah", "yep", "y", "true", "sí", "si", "是", "对", "係", "oo", "vâng", "نعم", "affirmative"]),
            ("No", ["no", "nope", "n", "false", "不", "不是", "唔係", "hindi", "không", "لا", "negative"]),
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
        code = exc.response["Error"]["Code"]
        message = str(exc.response["Error"].get("Message") or "")
        missing = code in {"ResourceNotFoundException", "NotFoundException", "PreconditionFailedException"}
        if missing or "does not exist" in message.lower():
            print(f"→ no existing DRAFT locale {locale}", flush=True)
        else:
            raise
    voice = VOICES[locale]
    create_kwargs: dict = {
        "botId": BOT_ID,
        "botVersion": "DRAFT",
        "localeId": locale,
        "nluIntentConfidenceThreshold": 0.7,
        "description": "Call Assist locale from lex-bot-complete-spec",
    }
    # Limited-ASR locales reject VoiceSettings ("only supported for Lex Native languages").
    if locale not in LIMITED_ASR_LOCALES:
        create_kwargs["voiceSettings"] = {"voiceId": voice["voiceId"], "engine": voice["engine"]}
    else:
        create_kwargs["generativeAISettings"] = {
            "runtimeSettings": {
                "nluImprovement": {
                    "enabled": True,
                    "assistedNluMode": "Primary",
                }
            }
        }
    lex.create_bot_locale(**create_kwargs)
    if locale in LIMITED_ASR_LOCALES:
        print(f"→ created locale {locale} (limited Lex ASR/TTS)", flush=True)
    else:
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


def list_all_intents(lex, locale: str) -> list[dict]:
    summaries: list[dict] = []
    next_token = None
    while True:
        kwargs: dict = {
            "botId": BOT_ID,
            "botVersion": "DRAFT",
            "localeId": locale,
            "maxResults": 100,
        }
        if next_token:
            kwargs["nextToken"] = next_token
        listed = lex.list_intents(**kwargs)
        summaries.extend(listed.get("intentSummaries") or [])
        next_token = listed.get("nextToken")
        if not next_token:
            break
    return summaries


def create_intents(lex, locale: str, type_ids: dict[str, str]) -> None:
    for priority, intent in enumerate(SPEC["intents"], start=1):
        name = intent["name"]
        utterances = utterances_for(intent, locale)
        limited = locale in LIMITED_ASR_LOCALES
        description = f"Call Assist {name}"
        if limited and utterances:
            description = f"{description}. Example caller phrases: {'; '.join(utterances[:12])}"
        kwargs: dict = {
            "botId": BOT_ID,
            "botVersion": "DRAFT",
            "localeId": locale,
            "intentName": name,
            "description": description,
            "dialogCodeHook": {"enabled": True},
            "fulfillmentCodeHook": {"enabled": True, "active": True},
        }
        if name == "FallbackIntent":
            if limited:
                print(f"   intent {name} (kept default — AMAZON.FallbackIntent not valid on limited locales)", flush=True)
                continue
            kwargs["parentIntentSignature"] = "AMAZON.FallbackIntent"
        elif utterances and not limited:
            kwargs["sampleUtterances"] = [{"utterance": u} for u in utterances]
        confirm = confirmation_for(intent, locale)
        if confirm and name not in NO_CONFIRM:
            ssml = confirm if confirm.strip().startswith("<speak>") else f"<speak>{confirm}</speak>"
            decline = DECLINE.get(locale, DECLINE["en_US"])
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
                listed = list_all_intents(lex, locale)
                fallback = next(i for i in listed if i["intentName"] == "FallbackIntent")
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
            if locale in LIMITED_ASR_LOCALES and slot_type.startswith("AMAZON."):
                slot_type = "FreeText"
            slot_type_id = type_ids.get(slot_type, slot_type)
            prompt = prompt_for(slot, locale)
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
            update_kwargs: dict = {
                "botId": BOT_ID,
                "botVersion": "DRAFT",
                "localeId": locale,
                "intentId": intent_id,
                "intentName": name,
                "description": description,
                "dialogCodeHook": {"enabled": True},
                "fulfillmentCodeHook": {"enabled": True, "active": True},
                "slotPriorities": [
                    {"priority": i, "slotId": slot_id} for i, slot_id in enumerate(slot_ids, start=1)
                ],
            }
            if utterances and not limited:
                update_kwargs["sampleUtterances"] = [{"utterance": u} for u in utterances]
            if "intentConfirmationSetting" in kwargs:
                update_kwargs["intentConfirmationSetting"] = kwargs["intentConfirmationSetting"]
            lex.update_intent(**update_kwargs)


def main() -> int:
    lex = client()
    locales = sys.argv[1:] or spec_locales(SPEC)
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
