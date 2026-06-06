# Supported call languages & text translation providers

Rapid Cortex supports **configurable multilingual call workflows across 100+ language codes** for **text translation** where **Azure Translator** or **Google Translate** provider coverage exists. **Azure Translator** is used as the **primary** text translation provider; **Google Translate** is available as a **backup**. Voice transcription and text-to-speech capabilities are tracked **separately** and depend on whichever speech providers are enabled (`PRIMARY_STT_PROVIDER`, silent-text TTS gates, etc.) — **do not assume** every translation language has live voice, STT, or TTS.

**See also:** [`911-language-fallback-reliability.md`](./911-language-fallback-reliability.md) — tiered 911 language fallback (detection → confidence → override → Azure/Google → phrases → interpreter → audit) and **RC Lite vs Rapid Cortex** positioning.

This document covers:

- How the **central registry** relates to runtime allowlists  
- **`SUPPORTED_CALL_LANGUAGES`** overrides + validation  
- **`TRANSLATION_PRIMARY_PROVIDER` / `TRANSLATION_FALLBACK_PROVIDER`**  
- How provider-backed language discovery works  
- Narrowing agencies to smaller language sets  
- Smoke testing evidence  

## Central registry

- Source code: `packages/shared/src/language-registry/`  
- Consumed by API + web via `rapid-cortex-shared` exports (`DEFAULT_SUPPORTED_CALL_LANGUAGES`, helpers).  
- Minimum **100** default rows (current builds ship **~180+** canonical codes including supplemental ISO-639-1 entries).  
- Capability flags are explicit; **text translation** defaults to `true` for informational rows, while **speech** flags default to `false`.

## Environment variables

### `SUPPORTED_CALL_LANGUAGES`

Comma-separated list of **canonical registry codes** (ASCII case-insensitive; whitespace trimmed; duplicates removed).

- **Unset / empty** → all default registry codes (`getSupportedCallLanguages()`).  
- Tokens not present in the registry are **ignored with warnings** (logged where `onWarning` / API warnings surface).  
- **`en` is always included by default** unless **`ALLOW_ENGLISH_LANGUAGE_REMOVAL=true`**.

Example (agency subset):

```bash
SUPPORTED_CALL_LANGUAGES=en,es,fr,ar,zh-Hans,zh-Hant,vi,ko,tl,ht,pt,ru,uk,pl,de,it,hi,ur,pa,bn,gu,ta,te,ja,fa,so,sw,am,he,th,lo,km,my,ne
```

### `ALLOW_ENGLISH_LANGUAGE_REMOVAL`

Defaults `false`. When **`true`**, parses may omit `en` if not listed (advanced deployments only).

### Translation provider ordering (text)

```bash
TRANSLATION_PRIMARY_PROVIDER=azure-translator
TRANSLATION_FALLBACK_PROVIDER=google-translate
```

Valid slugs: `azure-translator`, `google-translate`. Defaults preserve **Azure first**, **Google second**.

### Optional filters (language discovery API)

```bash
# Require these capability flags to remain listed (comma-separated)
SUPPORTED_CALL_LANGUAGE_CAPABILITIES=translation,speechToText,textToSpeech

# Minimum emergency tier (core < high < standard)
SUPPORTED_CALL_LANGUAGE_MIN_PRIORITY=standard
```

### AWS Translate status

AWS Translate may still participate in **voice/live translation chains** via `PRIMARY_TRANSLATION_PROVIDER` tiers, but **default silent-text / dispatcher translate helpers** (`translateFromEnglish`, `translateToEnglish`) prioritize **Azure → Google** per the orchestrator — **not** AWS as the assumed primary for that path.

## Provider-backed validation

1. Load static registry metadata (names, RTL hints, capability scaffolding).  
2. Apply `SUPPORTED_CALL_LANGUAGES` (+ English rule).  
3. Fetch **Azure** supported translation codes (public Languages API, cached).  
4. Fetch **Google** supported translation codes (Discovery API when credentials exist; otherwise static fallback list aligned to the registry).  
5. Annotate `providers.translation` arrays (`["azure-translator"]`, `["google-translate"]`, or both — **Azure always precedes Google** when both apply).  
6. Set `capabilities.translation` to **true only if at least one provider covers the code**; otherwise downgrade to `false` and emit contextual **warnings** (provider outages, unknown overrides, codes missing from both providers).

Secrets **never** appear in API payloads or logs for these endpoints.

## Narrowing an agency deployment

Use `SUPPORTED_CALL_LANGUAGES` to constrain UI + runtime validation to the codes you operate (for example PSAP policy). Combine with `SUPPORTED_CALL_LANGUAGE_CAPABILITIES` / `SUPPORTED_CALL_LANGUAGE_MIN_PRIORITY` when building admin tooling or filtered exports.

## Smoke evidence

```bash
npm run language-support:smoke
```

Set **`LANGUAGE_SMOKE_API_BASE`** (HTTP API Gateway base URL or local Next origin) and optionally:

- `LANGUAGE_SMOKE_BEARER`, or  
- `LANGUAGE_SMOKE_COOKIE` (for cookie-authenticated local SSR proxies)

The script checks:

1. HTTP success from `GET /api/call-intelligence/languages`  
2. `primaryProvider` / `fallbackProvider` defaults (unless you intentionally override env during the smoke run)  
3. Count ≥ 100 unless `SUPPORTED_CALL_LANGUAGES` restricts the list  
4. Presence of English & Spanish rows  
5. Arabic `direction === "rtl"`  
6. Mixed STT capabilities (not every language advertises STT)

## Product wording (approved)

> Rapid Cortex supports configurable multilingual call workflows across **100+ language codes** for **text translation** where **Azure Translator** or **Google Translate** provider support is available. **Azure Translator** is used as the primary provider, with **Google Translate** available as a backup. **Voice transcription** and **text-to-speech** capabilities are tracked separately and depend on the enabled speech providers.
