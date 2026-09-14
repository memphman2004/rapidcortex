#!/usr/bin/env python3
"""Generate connect/contact-flow-call-assist.json for live Call Assist DIDs.

Source of truth for DTMF / voices must stay aligned with
packages/shared/src/call-assist/connect-live.ts.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "connect" / "contact-flow-call-assist.json"

MENU_PROMPT = (
    "To continue in English, press 1. Spanish, press 2. Mandarin, press 3. "
    "Cantonese, press 4. Tagalog, press 5. Vietnamese, press 6. Arabic, press 7. "
    "Or stay on the line for the default language."
)

LAMBDA_ARN = (
    "arn:aws:lambda:us-east-1:158961537080:function:rapid-cortex-lex-agency-for-number-dev"
)

# id is used in action identifiers. digit is the language-menu DTMF.
LOCALES = [
    {
        "id": "en",
        "bcp47": "en-US",
        "lex": "en_US",
        "voice": "Ruth",
        "digit": "1",
        "aliases": ["en", "en-US", "en_US"],
    },
    {
        "id": "es",
        "bcp47": "es-US",
        "lex": "es_US",
        "voice": "Lupe",
        "digit": "2",
        "aliases": ["es", "es-US", "es_US"],
    },
    {
        "id": "zh-cn",
        "bcp47": "zh-CN",
        "lex": "zh_CN",
        "voice": "Zhiyu",
        "digit": "3",
        "aliases": ["zh", "zh-CN", "zh_CN", "cmn"],
    },
    {
        "id": "zh-hk",
        "bcp47": "zh-HK",
        "lex": "zh_HK",
        "voice": "Hiujin",
        "digit": "4",
        "aliases": ["yue", "zh-HK", "zh_HK", "zh-YUE"],
    },
    {
        "id": "tl",
        "bcp47": "tl-PH",
        "lex": "tl_PH",
        "voice": "Ruth",
        "digit": "5",
        "aliases": ["tl", "tl-PH", "tl_PH", "fil"],
    },
    {
        "id": "vi",
        "bcp47": "vi-VN",
        "lex": "vi_VN",
        "voice": "Linh",
        "digit": "6",
        "aliases": ["vi", "vi-VN", "vi_VN"],
    },
    {
        "id": "ar",
        "bcp47": "ar-AE",
        "lex": "ar_AE",
        "voice": "Hala",
        "digit": "7",
        "aliases": ["ar", "ar-AE", "ar_AE"],
    },
]


def voice_id(loc: dict) -> str:
    return f"set-voice-{loc['id']}"


def lang_id(loc: dict) -> str:
    return f"set-lang-{loc['id']}"


def apply_id(loc: dict) -> str:
    return f"apply-locale-{loc['id']}"


def cond(next_action: str, value: str) -> dict:
    return {
        "NextAction": next_action,
        "Condition": {"Operator": "Equals", "Operands": [value]},
    }


def err(next_action: str, error_type: str) -> dict:
    return {"NextAction": next_action, "ErrorType": error_type}


def passthrough(next_action: str) -> dict:
    return {
        "NextAction": next_action,
        "Errors": [err(next_action, "NoMatchingError")],
        "Conditions": [],
    }


def main() -> None:
    metadata = {
        "entryPointPosition": {"x": 20, "y": 20},
        "ActionMetadata": {
            "invoke-did-lookup": {"position": {"x": 160, "y": 20}},
            "apply-default-locale": {"position": {"x": 360, "y": 20}},
            "set-menu-voice": {
                "position": {"x": 560, "y": 20},
                "overrideConsoleVoice": True,
            },
            "language-menu": {"position": {"x": 780, "y": 20}},
            "check-language": {"position": {"x": 780, "y": 280}},
            "play-disclosure": {"position": {"x": 1580, "y": 20}},
            "lex-intake": {"position": {"x": 1820, "y": 20}},
            "play-emergency": {"position": {"x": 2060, "y": 20}},
            "check-escalation-mode": {"position": {"x": 2180, "y": 20}},
            "set-emergency-attrs": {"position": {"x": 2320, "y": 20}},
            "set-emergency-queue": {
                "position": {"x": 2480, "y": 20},
                "parameters": {"QueueId": {"displayName": "Call Assist Emergency"}},
                "queue": {"text": "Call Assist Emergency"},
            },
            "play-fallback": {"position": {"x": 2060, "y": 280}},
            "set-fallback-attrs": {"position": {"x": 2320, "y": 280}},
            "set-demo-queue": {
                "position": {"x": 2480, "y": 280},
                "parameters": {"QueueId": {"displayName": "Demo Dispatcher"}},
                "queue": {"text": "Demo Dispatcher"},
            },
            "transfer-queue": {"position": {"x": 2680, "y": 140}},
            "play-complete": {"position": {"x": 2060, "y": 480}},
            "disconnect": {"position": {"x": 2320, "y": 480}},
            "error-prompt": {"position": {"x": 1820, "y": 480}},
            "transfer-error-prompt": {"position": {"x": 2680, "y": 360}},
        },
    }

    for i, loc in enumerate(LOCALES):
        y = 20 + i * 110
        metadata["ActionMetadata"][voice_id(loc)] = {
            "position": {"x": 1040, "y": y},
            "overrideConsoleVoice": True,
            "overrideLanguageAttribute": True,
            "fragments": {"SetContactData": lang_id(loc)},
        }
        metadata["ActionMetadata"][lang_id(loc)] = {
            "position": {"x": 1040, "y": y},
            "dynamicParams": [],
        }
        metadata["ActionMetadata"][apply_id(loc)] = {"position": {"x": 1280, "y": y}}

    actions: list[dict] = [
        {
            "Identifier": "invoke-did-lookup",
            "Type": "InvokeLambdaFunction",
            "Parameters": {
                "LambdaFunctionARN": LAMBDA_ARN,
                "InvocationTimeLimitSeconds": "8",
                "LambdaInvocationAttributes": {
                    "phoneNumber": "$.SystemEndpoint.Address",
                    "ani": "$.CustomerEndpoint.Address",
                    "ALI": "$.Attributes.ALI",
                    "RapidSOSAddress": "$.Attributes.RapidSOSAddress",
                },
                "ResponseValidation": {"ResponseType": "STRING_MAP"},
            },
            "Transitions": {
                "NextAction": "apply-default-locale",
                "Errors": [err("error-prompt", "NoMatchingError")],
            },
        },
        {
            "Identifier": "apply-default-locale",
            "Type": "UpdateContactAttributes",
            "Parameters": {
                "Attributes": {
                    "language": "$.External.language",
                    "spokenGreeting": "$.External.greetingText",
                    "transferPrompt": "$.External.transferPrompt",
                    "errorPrompt": "$.External.errorPrompt",
                    "transferFailPrompt": "$.External.transferFailPrompt",
                }
            },
            "Transitions": passthrough("set-menu-voice"),
        },
        {
            "Identifier": "set-menu-voice",
            "Type": "UpdateContactTextToSpeechVoice",
            "Parameters": {
                "TextToSpeechVoice": "Ruth",
                "TextToSpeechEngine": "Neural",
                "TextToSpeechStyle": "None",
            },
            "Transitions": passthrough("language-menu"),
        },
        {
            "Identifier": "language-menu",
            "Type": "GetParticipantInput",
            "Parameters": {
                "StoreInput": "False",
                "InputTimeLimitSeconds": "8",
                "Text": MENU_PROMPT,
            },
            "Transitions": {
                "NextAction": "check-language",
                "Conditions": [cond(voice_id(loc), loc["digit"]) for loc in LOCALES],
                "Errors": [
                    err("check-language", "InputTimeLimitExceeded"),
                    err("check-language", "NoMatchingCondition"),
                    err("check-language", "NoMatchingError"),
                ],
            },
        },
        {
            "Identifier": "check-language",
            "Type": "Compare",
            "Parameters": {"ComparisonValue": "$.External.language"},
            "Transitions": {
                "NextAction": voice_id(LOCALES[0]),
                "Conditions": [
                    cond(voice_id(loc), alias) for loc in LOCALES for alias in loc["aliases"]
                ],
                "Errors": [err(voice_id(LOCALES[0]), "NoMatchingCondition")],
            },
        },
    ]

    for loc in LOCALES:
        actions.append(
            {
                "Identifier": voice_id(loc),
                "Type": "UpdateContactTextToSpeechVoice",
                "Parameters": {
                    "TextToSpeechVoice": loc["voice"],
                    "TextToSpeechEngine": "Neural",
                    "TextToSpeechStyle": "None",
                },
                "Transitions": passthrough(lang_id(loc)),
            }
        )
        actions.append(
            {
                "Identifier": lang_id(loc),
                "Type": "UpdateContactData",
                "Parameters": {"LanguageCode": loc["bcp47"]},
                "Transitions": passthrough(apply_id(loc)),
            }
        )
        actions.append(
            {
                "Identifier": apply_id(loc),
                "Type": "UpdateContactAttributes",
                "Parameters": {
                    "Attributes": {
                        "language": loc["bcp47"],
                        "spokenGreeting": f"$.External.greeting_{loc['lex']}",
                        "transferPrompt": f"$.External.transferPrompt_{loc['lex']}",
                        "errorPrompt": f"$.External.errorPrompt_{loc['lex']}",
                        "transferFailPrompt": f"$.External.transferFailPrompt_{loc['lex']}",
                    }
                },
                "Transitions": passthrough("play-disclosure"),
            }
        )

    actions.extend(
        [
            {
                "Identifier": "play-disclosure",
                "Type": "MessageParticipant",
                "Parameters": {"Text": "$.Attributes.spokenGreeting"},
                "Transitions": {
                    "NextAction": "lex-intake",
                    "Errors": [err("error-prompt", "NoMatchingError")],
                    "Conditions": [],
                },
            },
            {
                "Identifier": "lex-intake",
                "Type": "ConnectParticipantWithLexBot",
                "Parameters": {
                    "Text": "Go ahead.",
                    "LexV2Bot": {"AliasArn": "{{lexBotAliasArn}}"},
                    "LexSessionAttributes": {
                        "agencyId": "$.External.agencyId",
                        "callId": "$.ContactId",
                        "language": "$.Attributes.language",
                        "locale": "$.Attributes.language",
                        "bargeInEnabled": "true",
                        "ani": "$.CustomerEndpoint.Address",
                        "aliAddress": "$.External.aliAddress",
                        "ALI": "$.Attributes.ALI",
                        "RapidSOSAddress": "$.Attributes.RapidSOSAddress",
                        "apartmentSuite": "$.External.apartmentSuite",
                        "greetingDelivered": "true",
                        "greetingMode": "$.External.greetingMode",
                        "escalationMode": "$.External.escalationMode",
                        "emergencyTransferNumber": "$.External.emergencyTransferNumber",
                        "emergencyTransferQueue": "$.External.emergencyTransferQueue",
                        "enableColdClimate": "$.External.enableColdClimate",
                        "enableLiveAgentHandoff": "$.External.enableLiveAgentHandoff",
                    },
                    "LexTimeoutSeconds": {"Text": "300"},
                },
                "Transitions": {
                    "NextAction": "play-complete",
                    "Conditions": [
                        cond("play-emergency", "EmergencyEscalation"),
                        cond("play-fallback", "FallbackIntent"),
                        cond("play-fallback", "RequestHuman"),
                        cond("play-fallback", "RepeatCallCheck"),
                        cond("play-fallback", "PublicWorksIssue"),
                    ],
                    "Errors": [
                        err("error-prompt", "InputTimeLimitExceeded"),
                        err("error-prompt", "NoMatchingCondition"),
                        err("error-prompt", "NoMatchingError"),
                    ],
                },
            },
            {
                "Identifier": "play-emergency",
                "Type": "MessageParticipant",
                "Parameters": {"Text": "$.Lex.SessionAttributes.escalationAnnouncement"},
                "Transitions": {
                    "NextAction": "check-escalation-mode",
                    "Errors": [err("check-escalation-mode", "NoMatchingError")],
                    "Conditions": [],
                },
            },
            {
                "Identifier": "check-escalation-mode",
                "Type": "Compare",
                "Parameters": {"ComparisonValue": "$.Lex.SessionAttributes.escalationMode"},
                "Transitions": {
                    "NextAction": "set-emergency-attrs",
                    "Conditions": [cond("disconnect", "announce_and_end")],
                    "Errors": [err("set-emergency-attrs", "NoMatchingCondition")],
                },
            },
            {
                "Identifier": "set-emergency-attrs",
                "Type": "UpdateContactAttributes",
                "Parameters": {
                    "Attributes": {
                        "transferReason": "EMERGENCY",
                        "transferSummary": "$.Lex.SessionAttributes.transferSummary",
                        "transcript": "$.Lex.SessionAttributes.transcript",
                    }
                },
                "Transitions": passthrough("set-emergency-queue"),
            },
            {
                "Identifier": "set-emergency-queue",
                "Type": "UpdateContactTargetQueue",
                "Parameters": {"QueueId": "__EMERGENCY_QUEUE_ARN__"},
                "Transitions": {
                    "NextAction": "transfer-queue",
                    "Errors": [err("set-demo-queue", "NoMatchingError")],
                    "Conditions": [],
                },
            },
            {
                "Identifier": "play-fallback",
                "Type": "MessageParticipant",
                "Parameters": {"Text": "$.Attributes.transferPrompt"},
                "Transitions": {
                    "NextAction": "set-fallback-attrs",
                    "Errors": [err("set-fallback-attrs", "NoMatchingError")],
                    "Conditions": [],
                },
            },
            {
                "Identifier": "set-fallback-attrs",
                "Type": "UpdateContactAttributes",
                "Parameters": {
                    "Attributes": {
                        "transferReason": "LOW_CONFIDENCE",
                        "transcript": "$.Lex.SessionAttributes.transcript",
                    }
                },
                "Transitions": passthrough("set-demo-queue"),
            },
            {
                "Identifier": "set-demo-queue",
                "Type": "UpdateContactTargetQueue",
                "Parameters": {"QueueId": "__DEMO_QUEUE_ARN__"},
                "Transitions": {
                    "NextAction": "transfer-queue",
                    "Errors": [err("transfer-error-prompt", "NoMatchingError")],
                    "Conditions": [],
                },
            },
            {
                "Identifier": "transfer-queue",
                "Type": "TransferContactToQueue",
                "Parameters": {},
                "Transitions": {
                    "NextAction": "disconnect",
                    "Errors": [
                        err("transfer-error-prompt", "QueueAtCapacity"),
                        err("transfer-error-prompt", "NoMatchingError"),
                    ],
                },
            },
            {
                "Identifier": "play-complete",
                "Type": "MessageParticipant",
                "Parameters": {"Text": "$.Lex.SessionAttributes.closingMessage"},
                "Transitions": {
                    "NextAction": "disconnect",
                    "Errors": [err("disconnect", "NoMatchingError")],
                    "Conditions": [],
                },
            },
            {
                "Identifier": "disconnect",
                "Type": "DisconnectParticipant",
                "Parameters": {},
                "Transitions": {},
            },
            {
                "Identifier": "error-prompt",
                "Type": "MessageParticipant",
                "Parameters": {"Text": "$.Attributes.errorPrompt"},
                "Transitions": {
                    "NextAction": "set-demo-queue",
                    "Errors": [err("set-demo-queue", "NoMatchingError")],
                    "Conditions": [],
                },
            },
            {
                "Identifier": "transfer-error-prompt",
                "Type": "MessageParticipant",
                "Parameters": {"Text": "$.Attributes.transferFailPrompt"},
                "Transitions": {
                    "NextAction": "disconnect",
                    "Errors": [err("disconnect", "NoMatchingError")],
                    "Conditions": [],
                },
            },
        ]
    )

    flow = {
        "Version": "2019-10-30",
        "StartAction": "invoke-did-lookup",
        "Metadata": metadata,
        "Actions": actions,
    }
    OUT.write_text(json.dumps(flow, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {OUT} ({len(actions)} actions)")


if __name__ == "__main__":
    main()
