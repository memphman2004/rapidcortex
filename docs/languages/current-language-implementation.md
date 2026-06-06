# Current language and translation implementation

This document summarizes how Rapid Cortex handled **call languages** and **text translation** after the centralized registry and Azure→Google text path work. See also [`supported-call-languages.md`](./supported-call-languages.md) and the **911 operator tiered fallback** narrative in [`911-language-fallback-reliability.md`](./911-language-fallback-reliability.md).

## Default “top 10” call-routing codes

The historical default allowlist (still exported as `SUPPORTED_CALL_LANGUAGE_CODES`) is:

1. `en` — English  
2. `es` — Spanish  
3. `zh` — Chinese (bucketed for routing)  
4. `tl` — Tagalog / Filipino  
5. `vi` — Vietnamese  
6. `ar` — Arabic  
7. `fr` — French  
8. `ko` — Korean  
9. `ru` — Russian  
10. `pt` — Portuguese  

When `SUPPORTED_CALL_LANGUAGES` is **unset**, deployments now receive the **full default registry** (100+ canonical codes) produced by `packages/shared/src/language-registry/` instead of only these ten; the ten above remain valid subset codes.

## Files where language lists live

| Concern | Location |
|--------|----------|
| Canonical registry (100+ languages, capabilities, optional provider hints) | `packages/shared/src/language-registry/` (`build-default-supported-languages.ts`, `language-registry.ts`, `types.ts`) |
| Legacy exports + `normalizeCallLanguageCode` (live-call routing buckets) | `packages/shared/src/call-languages.ts` |
| Next.js re-exports (UI / web helpers) | `apps/web/lib/rapid-cortex/languages/language-registry.ts` |
| Runtime allowlist for services (`SUPPORTED_CALL_LANGUAGES`, English retention) | `apps/api/src/voice/multilingualConfig.ts` (via `parseSupportedCallLanguagesEnv(...)`) |

## Text translation (dispatcher / silent text / external translate)

| Concern | Location |
|--------|----------|
| Orchestrated **Azure Translator first**, **Google Cloud Translation second** | `apps/api/src/services/language/textTranslationOrchestrator.ts` |
| Azure REST general pair helper | `apps/api/src/services/language/azureTranslatorText.ts` |
| Google REST helpers (unchanged API surface) | `apps/api/src/services/language/googleTranslateClient.ts` |
| Facade used by services (`translateFromEnglish`, `translateToEnglish`, detection, TTS gates) | `apps/api/src/services/language/languageProviderFactory.ts` |
| Controlled JSON error type | `apps/api/src/services/language/translationControlledError.ts` |
| Safe provider attempt logging (no text / secrets) | `apps/api/src/services/language/translationAttemptLog.ts` |

Older paths that routed **default text translation through AWS Translate** for `translateFromEnglish` when `LANGUAGE_PROVIDER` resolved to `aws` were superseded for these functions: they now follow `TRANSLATION_PRIMARY_PROVIDER` / `TRANSLATION_FALLBACK_PROVIDER` (`azure-translator`, `google-translate` by default).

**`LANGUAGE_PROVIDER` (`aws` \| `google` \| `auto`) still controls:**

- Google-only detection when the “text backend” resolves to Google  
- Google TTS eligibility for silent text  
- Non-text stacks (STT / voice translation chains continue to use `PRIMARY_TRANSLATION_PROVIDER`, etc.)

## Azure Translator usage

- **Language discovery (public, no key):** `apps/api/src/languages/azure-translator-languages.ts` — GET Microsoft Languages API, cached.  
- **Translated text calls:** `azureTranslatorTranslateText` (subscription key + region headers).  
- **Voice pipeline x→English (unchanged class):** `apps/api/src/voice/azure/azureTranslatorProvider.ts` — still implements the `ITranslationProvider` interface (`targetLanguage: "en"`).

## Google Translate usage

- **Fallback text translation** via `googleMultilingualTranslateFromEnglish` / `…ToEnglish`.  
- **Optional language listing** (when credentials exist): `apps/api/src/languages/google-translate-languages.ts`; otherwise a static list derived from the registry.

## Provider fallback (text)

Yes: **Azure Translator is attempted first**, **Google Translate second**, subject to credentials and `TRANSLATION_*` env overrides. If both fail, callers receive a controlled `TranslationUnavailableError` payload (`status: "translation_unavailable"`) from `translationControlledError.ts` (e.g. External API v1 translate endpoint maps this to HTTP **422**).

## Unsupported language handling

- Registry parsing (`parseSupportedCallLanguagesEnvDetailed`) drops unknown CSV tokens and records warnings (no crash).  
- Translation requests still validate against the runtime `supportedLanguages` allowlist (`isSupportedCallLanguage` + registry-aware matching, including `zh`/script variants and `fil`/`tl`).

## Voice vs text

- Central registry models **explicit** `LanguageCapability` flags (`translation`, `speechToText`, `textToSpeech`, `realTimeVoice`, `callerSms`, `dispatcherUi`).  
- Defaults mark **translation** true for listed languages; voice-related flags remain **false** unless a deployment wires verified providers (do not assume universal STT/TTS/realtime voice coverage).

## API surface

| Endpoint | Purpose |
|---------|---------|
| `GET /api/call-intelligence/languages` | Provider-backed language discovery + capability overlay |  
| Next proxy | `apps/web/app/api/call-intelligence/languages/route.ts` |

Infrastructure: `CallIntelligenceLanguagesFunction` in `infra/template.yaml`.

## UI

- Dispatcher chrome loads the directory from `GET /api/call-intelligence/languages` (`apps/web/components/dispatch/call-language-selector-bar.tsx`). Append `?debug=languages` to surface provider tags quietly.

## Tests & smoke

- Vitest: `packages/shared/src/call-languages.test.ts`, `packages/shared/src/language-registry/language-registry.rtl-count.test.ts`, `apps/api/src/services/language/languageProviderFactory.test.ts`, `apps/api/src/services/language/textTranslationOrchestrator.test.ts`  
- Smoke script: `npm run language-support:smoke` (`scripts/language-support-smoke-test.ts`)

## Dependency note (developers)

`apps/api/package.json` consumes `rapid-cortex-shared` via the workspace version (`1.0.0`). If TypeScript still resolves a stale vendored copy under `apps/api/node_modules`, replace it with a symlink to `packages/shared` or reinstall so the workspace package is used after changing shared exports.
