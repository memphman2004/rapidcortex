import type { MultilingualVoiceConfig, VoiceProviderKind } from "../multilingualConfig.js";
import type { ISpeechToTextProvider } from "../interfaces.js";
import { MockSpeechToTextProvider } from "./mockSpeechToTextProvider.js";
import { AzureSpeechToTextProvider } from "../azure/azureSpeechSttProvider.js";
import { GoogleSpeechToTextProvider } from "../google/googleSpeechSttProvider.js";
import { AwsTranscribeSttProvider } from "../aws/awsTranscribeSttProvider.js";
import { OpenAiWhisperSttProvider } from "../openai/openaiWhisperSttProvider.js";

function buildOne(
  cfg: MultilingualVoiceConfig,
  kind: VoiceProviderKind,
  tier: "primary" | "secondary" | "tertiary",
): ISpeechToTextProvider | null {
  if (kind === "off") return null;
  if (kind === "mock") return new MockSpeechToTextProvider({ name: `mock-stt-${tier}` });
  if (kind === "azure") return new AzureSpeechToTextProvider(cfg, { name: `azure-stt-${tier}` });
  if (kind === "google") return new GoogleSpeechToTextProvider(cfg, { name: `google-stt-${tier}` });
  if (kind === "openai") return new OpenAiWhisperSttProvider(cfg, { name: `openai-whisper-${tier}` });
  if (kind === "aws") {
    const sttModelUsed =
      tier === "primary" ? cfg.sttModelPrimary : tier === "secondary" ? cfg.sttModelSecondary : cfg.sttModelTertiary;
    return new AwsTranscribeSttProvider(cfg, { name: `aws-transcribe-${tier}`, sttModelUsed });
  }
  return new MockSpeechToTextProvider({ name: `mock-stt-fallback-${tier}` });
}

export function buildSttProviderChain(cfg: MultilingualVoiceConfig): ISpeechToTextProvider[] {
  const kinds = [cfg.primarySttProvider, cfg.secondarySttProvider, cfg.tertiarySttProvider];
  const labels: ("primary" | "secondary" | "tertiary")[] = ["primary", "secondary", "tertiary"];
  const out: ISpeechToTextProvider[] = [];
  kinds.forEach((k, i) => {
    const p = buildOne(cfg, k, labels[i]!);
    if (p) out.push(p);
  });
  return out;
}
