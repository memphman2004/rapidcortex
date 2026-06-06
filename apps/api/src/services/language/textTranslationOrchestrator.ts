import type { MultilingualVoiceConfig } from "../../voice/multilingualConfig.js";
import { toTranslatePrimaryTag } from "rapid-cortex-shared";
import { VoiceProviderError } from "../../voice/providerErrors.js";
import { VOICE_ERROR_CODES } from "../../voice/voiceErrorCodes.js";
import { googleMultilingualTranslateFromEnglish, googleMultilingualTranslateToEnglish } from "./googleTranslateClient.js";
import { azureTranslatorTranslateText } from "./azureTranslatorText.js";
import { emitTranslationAttempt } from "./translationAttemptLog.js";
import { TranslationUnavailableError } from "./translationControlledError.js";

export type TextProviderKind = "azure-translator" | "google-translate";

function envOrder(): { primary: TextProviderKind; fallback: TextProviderKind } {
  const p = (process.env.TRANSLATION_PRIMARY_PROVIDER ?? "azure-translator").trim().toLowerCase();
  const f = (process.env.TRANSLATION_FALLBACK_PROVIDER ?? "google-translate").trim().toLowerCase();
  const primary: TextProviderKind = p === "google-translate" ? "google-translate" : "azure-translator";
  const fallback: TextProviderKind = f === "azure-translator" ? "azure-translator" : "google-translate";
  return { primary, fallback };
}

function attemptOrder(): TextProviderKind[] {
  const { primary, fallback } = envOrder();
  if (primary === fallback) return [primary];
  return [primary, fallback];
}

function missingGoogleCreds(cfg: MultilingualVoiceConfig): boolean {
  return !(
    Boolean(cfg.googleCloudProjectId) && Boolean(cfg.googleCredentialsSecretArn || cfg.googleApplicationCredentialsJson)
  );
}

function missingAzureCreds(cfg: MultilingualVoiceConfig): boolean {
  return !Boolean(cfg.azureTranslatorKey?.trim() || cfg.azureTranslatorKeySecretArn?.trim());
}

function isFallbackWorthy(): boolean {
  /** Attempt alternate provider whenever the first tier fails (best-effort; errors are sanitized in logs only). */
  return true;
}

export async function translateFromEnglishOrchestrated(
  cfg: MultilingualVoiceConfig,
  text: string,
  targetBcp: string,
  ctx: {
    signal?: AbortSignal;
    requestId?: string;
    agencyId?: string;
    incidentId?: string;
  },
): Promise<{ text: string; targetLanguage: string; confidence: number; provider: string }> {
  const tgt = toTranslatePrimaryTag(targetBcp);
  if (!text.trim()) {
    throw new VoiceProviderError("Empty text", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, { retryable: false });
  }
  if (tgt === "en" || tgt === "und") {
    return { text: text.trim(), targetLanguage: tgt, confidence: 1, provider: "passthrough" };
  }

  const order = attemptOrder();
  const attemptedOrdered: TextProviderKind[] = [];

  for (let i = 0; i < order.length; i++) {
    const p = order[i]!;
    const t0 = Date.now();

    try {
      if (p === "azure-translator") {
        if (missingAzureCreds(cfg)) {
          emitTranslationAttempt({
            event: "translation_attempt",
            provider: "azure-translator",
            sourceLanguage: "en",
            targetLanguage: tgt,
            success: false,
            durationMs: Date.now() - t0,
            reason: "azure_credentials_missing",
            requestId: ctx.requestId,
            agencyId: ctx.agencyId,
            incidentId: ctx.incidentId,
          });
          attemptedOrdered.push(p);
          if (i < order.length - 1 && isFallbackWorthy()) continue;
          break;
        }
        const out = await azureTranslatorTranslateText({
          cfg,
          text,
          from: "en",
          to: targetBcp.trim(),
          signal: ctx.signal,
          agencyId: ctx.agencyId,
        });
        emitTranslationAttempt({
          event: "translation_attempt",
          provider: "azure-translator",
          sourceLanguage: "en",
          targetLanguage: tgt,
          success: true,
          durationMs: Date.now() - t0,
          requestId: ctx.requestId,
          agencyId: ctx.agencyId,
          incidentId: ctx.incidentId,
        });
        attemptedOrdered.push(p);
        return {
          text: out.translatedText,
          targetLanguage: tgt,
          confidence: 0.92,
          provider: "azure-translator",
        };
      }

      if (missingGoogleCreds(cfg)) {
        emitTranslationAttempt({
          event: "translation_attempt",
          provider: "google-translate",
          sourceLanguage: "en",
          targetLanguage: tgt,
          success: false,
          durationMs: Date.now() - t0,
          reason: "google_credentials_missing",
          requestId: ctx.requestId,
          agencyId: ctx.agencyId,
          incidentId: ctx.incidentId,
        });
        attemptedOrdered.push(p);
        if (i < order.length - 1 && isFallbackWorthy()) continue;
        break;
      }

      const g = await googleMultilingualTranslateFromEnglish(cfg, text, targetBcp, ctx.signal);
      emitTranslationAttempt({
        event: "translation_attempt",
        provider: "google-translate",
        sourceLanguage: "en",
        targetLanguage: tgt,
        success: true,
        durationMs: Date.now() - t0,
        requestId: ctx.requestId,
        agencyId: ctx.agencyId,
        incidentId: ctx.incidentId,
      });
      attemptedOrdered.push(p);
      return {
        text: g.text,
        targetLanguage: g.targetLanguage,
        confidence: g.confidence,
        provider: "google-translate",
      };
    } catch {
      emitTranslationAttempt({
        event: "translation_attempt",
        provider: p,
        sourceLanguage: "en",
        targetLanguage: tgt,
        success: false,
        durationMs: Date.now() - t0,
        reason: "provider_error",
        requestId: ctx.requestId,
        agencyId: ctx.agencyId,
        incidentId: ctx.incidentId,
      });
      attemptedOrdered.push(p);
      if (i < order.length - 1 && isFallbackWorthy()) continue;
      break;
    }
  }

  const dedupAttempted = [...new Set(attemptedOrdered)];
  throw new TranslationUnavailableError({
    sourceLanguage: "en",
    targetLanguage: tgt,
    attemptedProviders:
      dedupAttempted.length > 0
        ? (dedupAttempted as TranslationUnavailableError["payload"]["attemptedProviders"])
        : [...order],
    message: "Translation is not currently available for the requested language pair.",
  });
}

export async function translateToEnglishOrchestrated(
  cfg: MultilingualVoiceConfig,
  text: string,
  sourceBcp: string,
  ctx: {
    signal?: AbortSignal;
    requestId?: string;
    agencyId?: string;
    incidentId?: string;
  },
): Promise<{ text: string; sourceLanguage: string; confidence: number; provider: string }> {
  const src = toTranslatePrimaryTag(sourceBcp);
  if (!text.trim()) {
    throw new VoiceProviderError("Empty text", VOICE_ERROR_CODES.TRANSLATION_INVALID_RESPONSE, { retryable: false });
  }
  if (src === "en") {
    return { text: text.trim(), sourceLanguage: "en", confidence: 1, provider: "passthrough" };
  }

  const order = attemptOrder();
  const attemptedOrdered: TextProviderKind[] = [];

  for (let i = 0; i < order.length; i++) {
    const p = order[i]!;
    const t0 = Date.now();
    try {
      if (p === "azure-translator") {
        if (missingAzureCreds(cfg)) {
          emitTranslationAttempt({
            event: "translation_attempt",
            provider: "azure-translator",
            sourceLanguage: src,
            targetLanguage: "en",
            success: false,
            durationMs: Date.now() - t0,
            reason: "azure_credentials_missing",
            requestId: ctx.requestId,
            agencyId: ctx.agencyId,
            incidentId: ctx.incidentId,
          });
          attemptedOrdered.push(p);
          if (i < order.length - 1 && isFallbackWorthy()) continue;
          break;
        }
        const out = await azureTranslatorTranslateText({
          cfg,
          text,
          from: sourceBcp.trim(),
          to: "en",
          signal: ctx.signal,
          agencyId: ctx.agencyId,
        });
        emitTranslationAttempt({
          event: "translation_attempt",
          provider: "azure-translator",
          sourceLanguage: src,
          targetLanguage: "en",
          success: true,
          durationMs: Date.now() - t0,
          requestId: ctx.requestId,
          agencyId: ctx.agencyId,
          incidentId: ctx.incidentId,
        });
        attemptedOrdered.push(p);
        return { text: out.translatedText, sourceLanguage: src, confidence: 0.92, provider: "azure-translator" };
      }

      if (missingGoogleCreds(cfg)) {
        emitTranslationAttempt({
          event: "translation_attempt",
          provider: "google-translate",
          sourceLanguage: src,
          targetLanguage: "en",
          success: false,
          durationMs: Date.now() - t0,
          reason: "google_credentials_missing",
          requestId: ctx.requestId,
          agencyId: ctx.agencyId,
          incidentId: ctx.incidentId,
        });
        attemptedOrdered.push(p);
        if (i < order.length - 1 && isFallbackWorthy()) continue;
        break;
      }

      const g = await googleMultilingualTranslateToEnglish(cfg, text, sourceBcp, ctx.signal);
      emitTranslationAttempt({
        event: "translation_attempt",
        provider: "google-translate",
        sourceLanguage: src,
        targetLanguage: "en",
        success: true,
        durationMs: Date.now() - t0,
        requestId: ctx.requestId,
        agencyId: ctx.agencyId,
        incidentId: ctx.incidentId,
      });
      attemptedOrdered.push(p);
      return { text: g.text, sourceLanguage: g.sourceLanguage, confidence: g.confidence, provider: "google-translate" };
    } catch {
      emitTranslationAttempt({
        event: "translation_attempt",
        provider: p,
        sourceLanguage: src,
        targetLanguage: "en",
        success: false,
        durationMs: Date.now() - t0,
        reason: "provider_error",
        requestId: ctx.requestId,
        agencyId: ctx.agencyId,
        incidentId: ctx.incidentId,
      });
      attemptedOrdered.push(p);
      if (i < order.length - 1 && isFallbackWorthy()) continue;
      break;
    }
  }

  const dedupAttempted = [...new Set(attemptedOrdered)];
  throw new TranslationUnavailableError({
    sourceLanguage: src,
    targetLanguage: "en",
    attemptedProviders:
      dedupAttempted.length > 0
        ? (dedupAttempted as TranslationUnavailableError["payload"]["attemptedProviders"])
        : [...order],
    message: "Translation is not currently available for the requested language pair.",
  });
}
