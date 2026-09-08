import {
  GENERIC_DISCLOSURE_TEXT,
  type CallAssistOnboardingInput,
  type OnboardingStepRecord,
} from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import { ContactFlowProvisioner } from "../connect/contact-flow-provisioner.js";
import { getOrCreateConfig } from "../config-service.js";
import { LexBotProvisioner, mockLexModelsPort } from "../lex/lex-bot-provisioner.js";
import { envLexQuotaPort } from "../lex/lex-quota.js";
import { TranscribeVocabularyService } from "../lex/transcribe-vocabulary-service.js";
import { callAssistStore } from "../store.js";
import { tenantToVoiceConfig } from "../voice-config-map.js";

function stage(): string {
  return env.deploymentStage || process.env.DEPLOYMENT_STAGE || "dev";
}

export class CallAssistOnboardingService {
  constructor(
    /** Live AWS Lex is not invoked while CALL_ASSIST_LEX_MOCK is the default. */
    private readonly bots = new LexBotProvisioner(mockLexModelsPort(), envLexQuotaPort()),
    private readonly flows = new ContactFlowProvisioner(),
    private readonly vocab = new TranscribeVocabularyService(),
  ) {}

  async onboardAgency(input: CallAssistOnboardingInput): Promise<void> {
    const existing = await getOrCreateConfig(input.agencyId);
    await callAssistStore.putConfig({
      ...existing,
      agencyId: input.agencyId,
      agencyName: input.agencyDisplayName,
      agencyDisplayName: input.agencyDisplayName,
      agencyShortName: input.agencyShortName,
      shortName: input.agencyShortName,
      agencyTypeLabel: input.agencyTypeLabel,
      officerLabel: input.officerLabel,
      nonEmergencyWebsite: input.nonEmergencyWebsite,
      onlineReportUrl: input.onlineReportPortalUrl || existing.onlineReportUrl,
      carfaxPortalUrl: input.carfaxPortalUrl || existing.carfaxPortalUrl,
      emergencyLine: "911",
      defaultLocale: "en_US",
      supportedLocales: input.supportedLocales,
      disclosureEnabled: true,
      disclosureText: existing.disclosureText || GENERIC_DISCLOSURE_TEXT,
      aiDisclosureRequired: input.aiDisclosureRequired,
      onboardingStatus: "BOT_CREATING",
      onboardingSteps: [],
      updatedAt: new Date().toISOString(),
    });

    await this.runStep(input.agencyId, "LEX_BOT_CREATE", async () => {
      const config = await getOrCreateConfig(input.agencyId);
      const record = await this.bots.provisionBot(input.agencyId, tenantToVoiceConfig(config), stage());
      await callAssistStore.putLexBot(record);
      await callAssistStore.putConfig({
        ...config,
        lexBotId: record.botId,
        lexBotAliasId: record.botAliasId,
        lexBotName: record.botName,
        lexBotTemplateVersion: record.templateVersion,
        lexBotStatus: "BUILT",
        onboardingStatus: "FLOW_CREATING",
        updatedAt: new Date().toISOString(),
      });
    });

    await this.runStep(input.agencyId, "CONNECT_FLOW_CREATE", async () => {
      const config = await getOrCreateConfig(input.agencyId);
      const flowId = await this.flows.createContactFlow(input.agencyId, tenantToVoiceConfig(config), stage());
      await callAssistStore.putConfig({
        ...config,
        connectContactFlowId: flowId,
        onboardingStatus: "VOCAB_UPLOADING",
        updatedAt: new Date().toISOString(),
      });
    });

    await this.runStep(input.agencyId, "TRANSCRIBE_VOCAB", async () => {
      const config = await getOrCreateConfig(input.agencyId);
      if (input.customVocabularyPhrases?.length) {
        const vocabName = await this.vocab.createAgencyVocabulary(
          input.agencyId,
          "en_US",
          input.customVocabularyPhrases,
        );
        await callAssistStore.putConfig({
          ...config,
          transcribeVocabularyName: vocabName,
          transcribeVocabularyStatus: "PENDING",
          onboardingStatus: "DID_PENDING",
          updatedAt: new Date().toISOString(),
        });
      } else {
        await callAssistStore.putConfig({
          ...config,
          onboardingStatus: "DID_PENDING",
          updatedAt: new Date().toISOString(),
        });
      }
    });
  }

  async claimDid(agencyId: string, phoneNumber: string): Promise<void> {
    await callAssistStore.putDidLookup(phoneNumber, agencyId);
    const config = await getOrCreateConfig(agencyId);
    await callAssistStore.putConfig({
      ...config,
      testDID: phoneNumber,
      connectNonEmergencyDID: phoneNumber,
      onboardingStatus: "SMOKE_TEST_PENDING",
      updatedAt: new Date().toISOString(),
    });
  }

  async retry(agencyId: string, createdBy: string): Promise<void> {
    const config = await getOrCreateConfig(agencyId);
    await this.onboardAgency({
      agencyId,
      agencyDisplayName: config.agencyDisplayName || config.agencyName || agencyId,
      agencyShortName: config.agencyShortName || config.shortName || agencyId,
      agencyTypeLabel: config.agencyTypeLabel || "911 Center",
      officerLabel: config.officerLabel || "officer",
      nonEmergencyWebsite: config.nonEmergencyWebsite,
      onlineReportPortalUrl: config.onlineReportUrl,
      carfaxPortalUrl: config.carfaxPortalUrl,
      supportedLocales: config.supportedLocales?.length ? config.supportedLocales : ["en_US"],
      aiDisclosureRequired: Boolean(config.aiDisclosureRequired),
      createdBy,
    });
  }

  private async runStep(agencyId: string, stepName: string, fn: () => Promise<void>): Promise<void> {
    await this.recordStep(agencyId, { step: stepName, status: "IN_PROGRESS", startedAt: new Date().toISOString() });
    try {
      await fn();
      await this.recordStep(agencyId, {
        step: stepName,
        status: "COMPLETE",
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.recordStep(agencyId, { step: stepName, status: "FAILED", error, completedAt: new Date().toISOString() });
      const config = await getOrCreateConfig(agencyId);
      await callAssistStore.putConfig({ ...config, onboardingStatus: "FAILED", updatedAt: new Date().toISOString() });
      throw err;
    }
  }

  private async recordStep(agencyId: string, step: OnboardingStepRecord): Promise<void> {
    const config = await getOrCreateConfig(agencyId);
    const steps = [...(config.onboardingSteps ?? []).filter((s) => s.step !== step.step), step];
    await callAssistStore.putConfig({ ...config, onboardingSteps: steps, updatedAt: new Date().toISOString() });
  }
}

export const callAssistOnboardingService = new CallAssistOnboardingService();
