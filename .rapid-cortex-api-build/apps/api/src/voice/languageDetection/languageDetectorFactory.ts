import type { MultilingualVoiceConfig, VoiceProviderKind } from "../multilingualConfig.js";
import type { ILanguageDetector } from "../interfaces.js";
import { MockLanguageDetector } from "./mockLanguageDetector.js";
import { AwsComprehendLanguageDetector } from "./awsComprehendLanguageDetector.js";
import { AzureTranslatorLanguageDetector } from "../azure/azureTranslatorLanguageDetector.js";
import { GoogleTranslateLanguageDetector } from "../google/googleTranslateLanguageDetector.js";

function buildOne(
  cfg: MultilingualVoiceConfig,
  kind: VoiceProviderKind,
  tier: "primary" | "secondary" | "tertiary",
): ILanguageDetector | null {
  if (kind === "off") return null;
  if (kind === "mock") return new MockLanguageDetector({ name: `mock-ld-${tier}` });
  if (kind === "azure") return new AzureTranslatorLanguageDetector(cfg, { name: `azure-ld-${tier}` });
  if (kind === "google") return new GoogleTranslateLanguageDetector(cfg, { name: `google-ld-${tier}` });
  if (kind === "aws") {
    return new AwsComprehendLanguageDetector({
      name: `aws-comprehend-ld-${tier}`,
      region: cfg.awsComprehendRegion,
    });
  }
  return new MockLanguageDetector({ name: `mock-ld-fallback-${tier}` });
}

export function buildLanguageDetectorChain(cfg: MultilingualVoiceConfig): ILanguageDetector[] {
  const kinds = [cfg.primaryLanguageDetector, cfg.secondaryLanguageDetector, cfg.tertiaryLanguageDetector];
  const labels: ("primary" | "secondary" | "tertiary")[] = ["primary", "secondary", "tertiary"];
  const out: ILanguageDetector[] = [];
  kinds.forEach((k, i) => {
    const d = buildOne(cfg, k, labels[i]!);
    if (d) out.push(d);
  });
  return out;
}
