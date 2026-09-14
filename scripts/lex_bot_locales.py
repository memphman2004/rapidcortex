"""Shared Lex locale keys, voices, and spec field accessors.

Tagalog (tl_PH) and Vietnamese (vi_VN) are Amazon Lex V2 limited-ASR locales
(asterisk in AWS docs — generative AI / third-party ASR-TTS). They are still
valid CreateBotLocale ids in us-east-1. Mandarin (zh_CN), Cantonese (zh_HK),
and Gulf Arabic (ar_AE) are full Lex locales.

CloudFormation `stack-lex.yaml` stays en_US + es_US (`cfnLocales`) so the nested
template does not exceed the SAM size proxy. Extra locales are imported onto
DRAFT via scripts/sync-lex-bot-draft.py.
"""
from __future__ import annotations

from typing import Any

# Lex V2 localeId → bot-spec.json field names
LOCALE_FIELDS: dict[str, dict[str, str]] = {
    "en_US": {"utterances": "utterancesEn", "prompt": "promptEn", "confirmation": "confirmationEn"},
    "es_US": {"utterances": "utterancesEs", "prompt": "promptEs", "confirmation": "confirmationEs"},
    "zh_CN": {"utterances": "utterancesZhCn", "prompt": "promptZhCn", "confirmation": "confirmationZhCn"},
    "zh_HK": {"utterances": "utterancesZhHk", "prompt": "promptZhHk", "confirmation": "confirmationZhHk"},
    "tl_PH": {"utterances": "utterancesTl", "prompt": "promptTl", "confirmation": "confirmationTl"},
    "vi_VN": {"utterances": "utterancesVi", "prompt": "promptVi", "confirmation": "confirmationVi"},
    "ar_AE": {"utterances": "utterancesAr", "prompt": "promptAr", "confirmation": "confirmationAr"},
}

VOICES: dict[str, dict[str, str]] = {
    "en_US": {"voiceId": "Ruth", "engine": "neural"},
    "es_US": {"voiceId": "Lupe", "engine": "neural"},
    "zh_CN": {"voiceId": "Zhiyu", "engine": "neural"},
    "zh_HK": {"voiceId": "Hiujin", "engine": "neural"},
    "ar_AE": {"voiceId": "Hala", "engine": "neural"},
    # Limited Lex locales: no first-party Polly voice bound to the locale id.
    # Linh / Olivia match packages/shared translate voice map; Lex may require
    # engine=neural. If CreateBotLocale rejects a voice, switch engine to generative.
    "vi_VN": {"voiceId": "Linh", "engine": "neural"},
    "tl_PH": {"voiceId": "Ruth", "engine": "neural"},
}

DECLINE: dict[str, str] = {
    "en_US": "I'm sorry about that. Let me start over. What would you like to correct?",
    "es_US": "Disculpe. Empecemos de nuevo. ¿Qué quisiera corregir?",
    "zh_CN": "抱歉，我们重新开始。您想更正哪一项？",
    "zh_HK": "唔好意思，我哋重新開始。你想更正邊一項？",
    "tl_PH": "Pasensya na. Umpisahan po natin ulit. Ano po ang gusto ninyong itama?",
    "vi_VN": "Xin lỗi. Chúng ta bắt đầu lại. Bạn muốn sửa thông tin nào?",
    "ar_AE": "عذراً. لنبدأ من جديد. ما الذي تريد تصحيحه؟",
}

LIMITED_ASR_LOCALES = frozenset({"tl_PH", "vi_VN"})

TS_PROMPT_FIELDS = {
    "en_US": "promptEn",
    "es_US": "promptEs",
    "zh_CN": "promptZhCn",
    "zh_HK": "promptZhHk",
    "tl_PH": "promptTl",
    "vi_VN": "promptVi",
    "ar_AE": "promptAr",
}


def cfn_locales(spec: dict[str, Any]) -> list[str]:
    return list(spec.get("cfnLocales") or ["en_US", "es_US"])


def spec_locales(spec: dict[str, Any]) -> list[str]:
    return list(spec.get("locales") or ["en_US", "es_US"])


def alias_locale_settings(lambda_arn: str, locales: list[str] | None = None) -> dict[str, Any]:
    ids = locales or list(LOCALE_FIELDS.keys())
    hook = {
        "lambdaARN": lambda_arn,
        "codeHookInterfaceVersion": "1.0",
    }
    return {
        locale: {
            "enabled": True,
            "codeHookSpecification": {"lambdaCodeHook": hook},
        }
        for locale in ids
    }


def bot_version_locale_specification(locales: list[str] | None = None) -> dict[str, Any]:
    ids = locales or list(LOCALE_FIELDS.keys())
    return {locale: {"sourceBotVersion": "DRAFT"} for locale in ids}


def utterances_for(intent: dict[str, Any], locale: str) -> list[str]:
    field = LOCALE_FIELDS.get(locale, LOCALE_FIELDS["en_US"])["utterances"]
    values = intent.get(field)
    if values:
        return list(values)
    return list(intent.get("utterancesEn") or [])


def prompt_for(slot: dict[str, Any], locale: str) -> str:
    field = LOCALE_FIELDS.get(locale, LOCALE_FIELDS["en_US"])["prompt"]
    value = slot.get(field)
    if isinstance(value, str) and value.strip():
        return value
    return str(slot.get("promptEn") or "")


def confirmation_for(intent: dict[str, Any], locale: str) -> str | None:
    field = LOCALE_FIELDS.get(locale, LOCALE_FIELDS["en_US"])["confirmation"]
    value = intent.get(field)
    if isinstance(value, str) and value.strip():
        return value
    if locale != "en_US":
        en = intent.get("confirmationEn")
        if isinstance(en, str) and en.strip():
            return en
    return None


def merge_locale_copy(spec: dict[str, Any], copy: dict[str, Any]) -> dict[str, Any]:
    extra = list(copy.get("locales") or [])
    locales = list(spec.get("locales") or [])
    for loc in extra:
        if loc not in locales:
            locales.append(loc)
    spec["locales"] = locales
    spec.setdefault("cfnLocales", ["en_US", "es_US"])
    by_name = {intent["name"]: intent for intent in spec.get("intents") or []}
    for name, overlay in (copy.get("intents") or {}).items():
        intent = by_name.get(name)
        if not intent or not isinstance(overlay, dict):
            continue
        for key, value in overlay.items():
            if key == "prompts" and isinstance(value, dict):
                slots_by_name = {slot["name"]: slot for slot in intent.get("slots") or []}
                for slot_name, prompts in value.items():
                    slot = slots_by_name.get(slot_name)
                    if not slot or not isinstance(prompts, dict):
                        continue
                    for locale, text in prompts.items():
                        field = LOCALE_FIELDS.get(locale, {}).get("prompt")
                        if field and isinstance(text, str):
                            slot[field] = text
            elif isinstance(key, str) and (key.startswith("utterances") or key.startswith("confirmation")):
                intent[key] = value
    return spec


def load_merged_spec(root: Any) -> dict[str, Any]:
    import json
    from pathlib import Path

    base = Path(root)
    spec = json.loads((base / "infra" / "lex" / "bot-spec.json").read_text(encoding="utf-8"))
    copy_path = base / "infra" / "lex" / "locale-copy.json"
    if copy_path.exists():
        merge_locale_copy(spec, json.loads(copy_path.read_text(encoding="utf-8")))
    return spec
