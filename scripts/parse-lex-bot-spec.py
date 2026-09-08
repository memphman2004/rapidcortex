#!/usr/bin/env python3
"""Parse connect/lex-bot-complete-spec.md into infra/lex/bot-spec.json."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = ROOT / "connect" / "lex-bot-complete-spec.md"
OUT = ROOT / "infra" / "lex" / "bot-spec.json"

INTENT_SPLIT = re.compile(r"^## INTENT \d+: `([^`]+)`", re.M)
UTT_EN = re.compile(
    r"### Sample Utterances — English[^\n]*\n```\n(.*?)```",
    re.S,
)
UTT_ES = re.compile(
    r"### Sample Utterances — Spanish[^\n]*\n```\n(.*?)```",
    re.S,
)
SLOT_RE = re.compile(
    r"\*\*Slot \d+: `([^`]+)`\*\*\s*\(type:\s*([^)]+)\)\s*"
    r"(?:(?!\*\*Slot ).)*?"
    r"Prompt EN:\s*`([^`]*)`\s*"
    r"Prompt ES:\s*`([^`]*)`",
    re.S,
)
CONFIRM_EN = re.compile(r"### Confirmation Prompt\s+EN:\s*`([^`]+)`", re.S)
CONFIRM_ES = re.compile(r"### Confirmation Prompt\s+.*?ES:\s*`([^`]+)`", re.S)


def lines(block: str) -> list[str]:
    return [ln.strip() for ln in block.splitlines() if ln.strip()]


def slot_type(raw: str) -> tuple[str, bool]:
    optional = "optional" in raw.lower()
    lower = raw.lower()
    if "lambda evaluates" in lower:
        return ("", False)
    if "noise descriptor" in lower:
        return ("NoiseType", optional)
    if "violation type" in lower:
        return ("ParkingViolationType", optional)
    if "threat level" in lower:
        return ("AnimalThreatLevel", optional)
    t = raw.split("—")[0].split(",")[0].strip()
    t = re.sub(r"\s+", " ", t)
    mapping = {
        "LocationAddress": "LocationAddress",
        "AMAZON.Confirmation": "YesNoConfirmation",
        "AMAZON.PhoneNumber": "AMAZON.PhoneNumber",
        "AMAZON.AlphaNumeric": "FreeText",
        "IncidentTimeframe": "IncidentTimeframe",
        "free text via AMAZON.AlphaNumeric": "FreeText",
        "Custom": "FreeText",
    }
    name = mapping.get(t)
    if name is None and t.startswith("Custom"):
        name = "FreeText"
    if name is None and "AlphaNumeric" in t:
        name = "FreeText"
    if name is None and "PhoneNumber" in t:
        name = "AMAZON.PhoneNumber"
    if name is None and "Confirmation" in t:
        name = "YesNoConfirmation"
    if name is None and "LocationAddress" in t:
        name = "LocationAddress"
    if name is None and "IncidentTimeframe" in t:
        name = "IncidentTimeframe"
    if t.startswith("Lambda"):
        return ("", False)
    return (name or "FreeText", optional)


def parse() -> dict:
    text = SPEC.read_text(encoding="utf-8")
    parts = INTENT_SPLIT.split(text)
    intents: list[dict] = []
    # parts: [preamble, name1, body1, name2, body2, ...]
    for i in range(1, len(parts), 2):
        name = parts[i]
        body = parts[i + 1]
        en_m = UTT_EN.search(body)
        es_m = UTT_ES.search(body)
        slots = []
        for sm in SLOT_RE.finditer(body):
            st, optional = slot_type(sm.group(2))
            if not st:
                continue
            slots.append(
                {
                    "name": sm.group(1),
                    "slotType": st,
                    "required": not optional,
                    "promptEn": sm.group(3),
                    "promptEs": sm.group(4),
                }
            )
        # CARFAXCheck and similar skipped by Lambda-evaluates type
        confirm_en = CONFIRM_EN.search(body)
        confirm_es = CONFIRM_ES.search(body)
        intents.append(
            {
                "name": name,
                "utterancesEn": lines(en_m.group(1)) if en_m else [],
                "utterancesEs": lines(es_m.group(1)) if es_m else [],
                "slots": slots,
                "confirmationEn": confirm_en.group(1).strip() if confirm_en else None,
                "confirmationEs": confirm_es.group(1).strip() if confirm_es else None,
            }
        )
    return {
        "botName": "RCCallAssistBot",
        "locales": ["en_US", "es_US"],
        "priority": [i["name"] for i in intents],
        "intents": intents,
    }


def main() -> None:
    data = parse()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(data['intents'])} intents)")
    for intent in data["intents"]:
        print(
            f"  {intent['name']}: en={len(intent['utterancesEn'])} es={len(intent['utterancesEs'])} slots={len(intent['slots'])}"
        )


if __name__ == "__main__":
    main()
