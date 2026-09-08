import type { CallAssistAgencyVoiceConfig } from "rapid-cortex-shared";

export type ContactFlowParams = {
  agencyId: string;
  lexBotId: string;
  lexBotAliasId: string;
  primaryQueueArn: string;
  emergencyQueueArn: string;
  fulfillmentLambdaArn: string;
  lexBotAliasArn?: string;
  stage: string;
};

export function parameterizeContactFlowTemplate(template: string, params: ContactFlowParams): string {
  return template
    .replaceAll("{{agencyId}}", params.agencyId)
    .replaceAll("{{lexBotId}}", params.lexBotId)
    .replaceAll("{{lexBotAliasId}}", params.lexBotAliasId)
    .replaceAll("{{primaryQueueArn}}", params.primaryQueueArn)
    .replaceAll("{{emergencyQueueArn}}", params.emergencyQueueArn)
    .replaceAll("{{fulfillmentLambdaArn}}", params.fulfillmentLambdaArn)
    .replaceAll("{{lexBotAliasArn}}", params.lexBotAliasArn ?? "")
    .replaceAll("{{stage}}", params.stage);
}

export class ContactFlowProvisioner {
  async createContactFlow(
    agencyId: string,
    config: CallAssistAgencyVoiceConfig,
    stage: string,
  ): Promise<string> {
    if (!config.lexBotId || !config.lexBotAliasId) {
      throw new Error(`Contact flow requires lexBotId/lexBotAliasId for ${agencyId}`);
    }
    // Live Connect CreateContactFlow is wired in production; mock returns a stable id.
    return `mock-flow-${agencyId}-${stage}`;
  }
}
