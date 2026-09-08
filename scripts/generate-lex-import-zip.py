#!/usr/bin/env python3
"""Build a Lex V2 locale-import zip from infra/lex/bot-spec.json (DRAFT only — does not update aliases)."""
from __future__ import annotations

import json
import os
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads((ROOT / "infra" / "lex" / "bot-spec.json").read_text(encoding="utf-8"))
OUT_DIR = ROOT / "infra" / "lex" / "import"
VOICE_KEYS = ("agencyShortName", "agencyName", "agencyWebsite", "emergencyLine", "nonEmergencyWebsite")
VOICE_DEFAULTS = {
    "agencyShortName": os.environ.get("LEX_AGENCY_SHORT_NAME", "this agency"),
    "agencyName": os.environ.get("LEX_AGENCY_NAME", "this agency"),
    "agencyWebsite": os.environ.get("LEX_AGENCY_WEBSITE", "your agency website"),
    "nonEmergencyWebsite": os.environ.get("LEX_AGENCY_WEBSITE", "your agency website"),
    "emergencyLine": os.environ.get("LEX_EMERGENCY_LINE", "911"),
}


def substitute_voice(text: str) -> str:
    out = text
    for key in VOICE_KEYS:
        value = VOICE_DEFAULTS[key]
        out = out.replace("{{" + key + "}}", value).replace("{" + key + "}", value)
    return out


def walk_voice(obj):
    if isinstance(obj, str):
        return substitute_voice(obj)
    if isinstance(obj, list):
        return [walk_voice(item) for item in obj]
    if isinstance(obj, dict):
        return {key: walk_voice(value) for key, value in obj.items()}
    return obj

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

SLOT_TYPES = [
    {
        "name": "FreeText",
        "description": "Original caller phrasing",
        "resolution": "ORIGINAL_VALUE",
        "values": [("unknown", []), ("none", [])],
    },
    {
        "name": "LocationAddress",
        "description": "Address, intersection, landmark, or business name",
        "resolution": "ORIGINAL_VALUE",
        "values": [("address", []), ("intersection", []), ("landmark", [])],
    },
    {
        "name": "VehicleColor",
        "description": "Vehicle color with synonyms",
        "resolution": "TOP_RESOLUTION",
        "values": [
            ("Red", ["red", "crimson", "maroon", "dark red", "bright red"]),
            ("Blue", ["blue", "navy", "dark blue", "light blue", "sky blue", "royal blue"]),
            ("Black", ["black", "dark", "jet black"]),
            ("White", ["white", "cream", "off-white", "pearl"]),
            ("Silver", ["silver", "gray", "grey", "metallic"]),
            ("Green", ["green", "olive", "dark green", "forest green"]),
            ("Gold", ["gold", "tan", "beige", "champagne"]),
            ("Brown", ["brown", "bronze", "copper", "rust"]),
        ],
    },
    {
        "name": "VehicleType",
        "description": "Vehicle body type",
        "resolution": "TOP_RESOLUTION",
        "values": [
            ("car", ["sedan", "coupe", "convertible"]),
            ("truck", ["pickup", "pickup truck"]),
            ("SUV", ["crossover", "van", "minivan"]),
            ("motorcycle", ["bike", "moped", "scooter"]),
            ("semi", ["eighteen-wheeler", "box truck", "delivery truck"]),
        ],
    },
    {
        "name": "IncidentTimeframe",
        "description": "When the incident occurred",
        "resolution": "TOP_RESOLUTION",
        "values": [
            ("right now", ["happening now", "currently", "still going on"]),
            ("just happened", ["a few minutes ago", "minutes ago", "just now"]),
            ("earlier today", ["about an hour ago", "this morning", "this afternoon", "tonight"]),
            ("yesterday", ["last night", "a while ago"]),
            ("not sure", ["I don't know", "unknown"]),
        ],
    },
    {
        "name": "NoiseType",
        "description": "Kind of noise",
        "resolution": "ORIGINAL_VALUE",
        "values": [(v, []) for v in ("music", "yelling", "party", "fireworks", "barking", "engine", "alarm", "other")],
    },
    {
        "name": "ParkingViolationType",
        "description": "Parking violation type",
        "resolution": "ORIGINAL_VALUE",
        "values": [
            (v, [])
            for v in ("driveway", "fire hydrant", "handicap", "no parking", "fire lane", "sidewalk", "other")
        ],
    },
    {
        "name": "AnimalThreatLevel",
        "description": "Animal situation severity",
        "resolution": "TOP_RESOLUTION",
        "values": [
            ("aggressive", ["attacking", "vicious", "biting"]),
            ("injured", []),
            ("stray", ["loose", "loose/stray"]),
            ("cruelty", ["neglect", "cruelty/neglect"]),
            ("nuisance", []),
        ],
    },
    {
        "name": "YesNoConfirmation",
        "description": "Yes/no confirmation",
        "resolution": "TOP_RESOLUTION",
        "values": [
            ("Yes", ["yes", "yeah", "yep", "y", "true", "sí", "si", "affirmative"]),
            ("No", ["no", "nope", "n", "false", "negative"]),
        ],
    },
]


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(omit_none(data), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def omit_none(value: object) -> object:
    if isinstance(value, dict):
        return {k: omit_none(v) for k, v in value.items() if v is not None}
    if isinstance(value, list):
        return [omit_none(v) for v in value if v is not None]
    return value


def slot_type_json(spec: dict) -> dict:
    values = []
    for value, synonyms in spec["values"]:
        values.append(
            {
                "sampleValue": {"value": value},
                "synonyms": [{"value": s} for s in synonyms] or None,
            }
        )
    return {
        "name": spec["name"],
        "identifier": None,
        "description": spec["description"],
        "slotTypeValues": values,
        "parentSlotTypeSignature": None,
        "valueSelectionSetting": {
            "resolutionStrategy": spec["resolution"],
            "regexFilter": None,
        },
    }


def prompt_group(text: str, ssml: bool = False) -> dict:
    msg = {
        "plainTextMessage": None if ssml else {"value": text},
        "ssmlMessage": {"value": text} if ssml else None,
        "customPayload": None,
        "imageResponseCard": None,
    }
    return {"message": msg, "variations": None}


def intent_json(intent: dict, locale: str) -> dict:
    utterances = intent["utterancesEn"] if locale == "en_US" else intent["utterancesEs"]
    name = intent["name"]
    confirm = intent["confirmationEn"] if locale == "en_US" else (intent["confirmationEs"] or intent["confirmationEn"])
    body: dict = {
        "name": name,
        "description": f"Call Assist intent {name}",
        "parentIntentSignature": "AMAZON.FallbackIntent" if name == "FallbackIntent" else None,
        "sampleUtterances": [{"utterance": u} for u in utterances] or None,
        "dialogCodeHook": {"enabled": True},
        "fulfillmentCodeHook": {"enabled": True, "active": True, "postFulfillmentStatusSpecification": None},
        "slotPriorities": [
            {"priority": i, "slotName": slot["name"]} for i, slot in enumerate(intent["slots"], start=1)
        ]
        or None,
        "intentConfirmationSetting": None,
        "intentClosingSetting": None,
        "inputContexts": None,
        "outputContexts": None,
        "kendraConfiguration": None,
    }
    if confirm and name not in NO_CONFIRM:
        ssml = confirm if confirm.strip().startswith("<speak>") else f"<speak>{confirm}</speak>"
        body["intentConfirmationSetting"] = {
            "promptSpecification": {
                "messageGroupsList": [prompt_group(ssml, ssml=True)],
                "maxRetries": 2,
                "allowInterrupt": True,
            },
            "declinationResponse": {
                "messageGroupsList": [prompt_group(DECLINE[locale])],
            },
            "isActive": True,
        }
    return body


def slot_json(slot: dict, locale: str) -> dict:
    prompt = slot["promptEn"] if locale == "en_US" else slot["promptEs"]
    return {
        "name": slot["name"],
        "description": slot["name"],
        "slotTypeName": slot["slotType"],
        "obfuscationSetting": None,
        "slotConstraint": "Required" if slot["required"] else "Optional",
        "defaultValueSpec": None,
        "multipleValuesSetting": {"allowMutlipleValues": False},
        "slotValueElicitationSetting": {
            "promptSpecification": {
                "messageGroupsList": [prompt_group(prompt)],
                "maxRetries": 2,
                "allowInterrupt": True,
            },
            "sampleValueElicitingUtterances": None,
            "waitAndContinueSpecification": None,
        },
    }


def locale_json(locale: str) -> dict:
    voices = {"en_US": "Ruth", "es_US": "Lupe"}
    return {
        "name": locale,
        "identifier": locale,
        "description": "Call Assist locale",
        "voiceSettings": {"voiceId": voices[locale], "engine": "neural"},
        "nluConfidenceThreshold": 0.7,
    }


def build_tree() -> Path:
    bot_name = os.environ.get("LEX_BOT_NAME", "RCCallAssistBot-dev")
    base = OUT_DIR / bot_name
    if OUT_DIR.exists():
        for child in OUT_DIR.rglob("*"):
            if child.is_file():
                child.unlink()
    write_json(
        OUT_DIR / "manifest.json",
        {"metadata": {"schemaVersion": "1.0", "fileFormat": "LexJson", "resourceType": "Bot"}},
    )
    write_json(
        base / "Bot.json",
        {
            "name": bot_name,
            "identifier": "IJIBJOJG2L",
            "description": "Rapid Cortex non-emergency conversational AI. Multi-tenant. Safety gate is Lambda, not NLU.",
            "dataPrivacy": {"childDirected": False},
            "idleSessionTTLInSeconds": 300,
        },
    )
    for locale in SPEC["locales"]:
        loc_dir = base / "BotLocales" / locale
        write_json(loc_dir / "BotLocale.json", locale_json(locale))
        for st in SLOT_TYPES:
            write_json(loc_dir / "SlotTypes" / st["name"] / "SlotType.json", slot_type_json(st))
        for intent in SPEC["intents"]:
            intent_dir = loc_dir / "Intents" / intent["name"]
            write_json(intent_dir / "Intent.json", walk_voice(intent_json(intent, locale)))
            for slot in intent["slots"]:
                write_json(intent_dir / "Slots" / slot["name"] / "Slot.json", walk_voice(slot_json(slot, locale)))
    zip_path = ROOT / "infra" / "lex" / "RCCallAssistBot-import.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in OUT_DIR.rglob("*"):
            if path.is_file():
                zf.write(path, path.relative_to(OUT_DIR))
    return zip_path


def main() -> None:
    zip_path = build_tree()
    print(f"Wrote {zip_path} ({zip_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
