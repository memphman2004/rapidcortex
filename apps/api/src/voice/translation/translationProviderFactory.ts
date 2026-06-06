import type { MultilingualVoiceConfig, VoiceProviderKind } from "../multilingualConfig.js";
import type { ITranslationProvider } from "../interfaces.js";
import { assertProviderAllowedForAgency, inferProviderFromAdapterName } from "../../ai/providerPolicy.js";
import { sanitizeForProvider } from "../../ai/sanitization.js";
import { MockTranslationProvider } from "./mockTranslationProvider.js";
import { AwsTranslateProvider } from "./awsTranslateProvider.js";
import { AzureTranslatorProvider } from "../azure/azureTranslatorProvider.js";
import { GoogleTranslationProvider } from "../google/googleTranslationProvider.js";

function buildOne(
  cfg: MultilingualVoiceConfig,
  kind: VoiceProviderKind,
  tier: "primary" | "secondary" | "tertiary",
): ITranslationProvider | null {
  if (kind === "off") return null;
  if (kind === "mock") return new MockTranslationProvider({ name: `mock-tr-${tier}` });
  if (kind === "azure") return new AzureTranslatorProvider(cfg, { name: `azure-tr-${tier}` });
  if (kind === "google") return new GoogleTranslationProvider(cfg, { name: `google-tr-${tier}` });
  if (kind === "aws") {
    return new AwsTranslateProvider({ name: `aws-translate-${tier}`, region: cfg.awsTranslateRegion });
  }
  return new MockTranslationProvider({ name: `mock-tr-fallback-${tier}` });
}

export function buildTranslationProviderChain(cfg: MultilingualVoiceConfig): ITranslationProvider[] {
  const kinds = [
    cfg.primaryTranslationProvider,
    cfg.secondaryTranslationProvider,
    cfg.tertiaryTranslationProvider,
  ];
  const labels: ("primary" | "secondary" | "tertiary")[] = ["primary", "secondary", "tertiary"];
  const out: ITranslationProvider[] = [];
  kinds.forEach((k, i) => {
    const p = buildOne(cfg, k, labels[i]!);
    if (!p) return;
    const wrapped: ITranslationProvider = {
      name: p.name,
      async translate(text, sourceLanguage, targetLanguage, options) {
        const agencyId = options?.agencyId;
        if (agencyId) {
          await assertProviderAllowedForAgency({
            agencyId,
            provider: inferProviderFromAdapterName(p.name),
            surface: "translation",
          });
        }
        const sanitized = sanitizeForProvider({
          content: text,
          provider: p.name,
          agencyId,
        });
        return p.translate(sanitized.sanitizedContent, sourceLanguage, targetLanguage, options);
      },
    };
    out.push(wrapped);
  });
  return out;
}
