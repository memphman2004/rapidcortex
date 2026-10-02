import {
  ConnectClient,
  CreateContactFlowCommand,
  UpdateContactFlowContentCommand,
  ListContactFlowsCommand,
} from "@aws-sdk/client-connect";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";
import type { CallAssistAgencyVoiceConfig } from "rapid-cortex-shared";
import { env } from "../../lib/env.js";
import contactFlowTemplate from "./contact-flow-template.json";

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
    .replaceAll("{{stage}}", params.stage)
    .replaceAll("__DEMO_QUEUE_ARN__", params.primaryQueueArn)
    .replaceAll("__EMERGENCY_QUEUE_ARN__", params.emergencyQueueArn);
}

function connectClient(): ConnectClient {
  return new ConnectClient({ region: env.region || process.env.AWS_REGION || "us-east-1" });
}

function flowName(agencyId: string, stage: string): string {
  return `CallAssist-${agencyId}-${stage}`.replace(/[^a-zA-Z0-9-_ ]/g, "").slice(0, 127);
}

async function resolveAccountId(): Promise<string> {
  const fromEnv =
    process.env.AWS_ACCOUNT_ID?.trim() ||
    process.env.CDK_DEFAULT_ACCOUNT?.trim() ||
    process.env.ACCOUNT_ID?.trim() ||
    "";
  if (fromEnv) return fromEnv;
  const sts = new STSClient({ region: env.region || process.env.AWS_REGION || "us-east-1" });
  const id = await sts.send(new GetCallerIdentityCommand({}));
  return id.Account?.trim() ?? "";
}

async function resolveFlowParams(
  agencyId: string,
  config: CallAssistAgencyVoiceConfig,
  stage: string,
): Promise<ContactFlowParams> {
  const region = env.region || process.env.AWS_REGION || "us-east-1";
  const account = await resolveAccountId();
  const lexBotId = config.lexBotId!;
  const lexBotAliasId = config.lexBotAliasId!;
  const lexBotAliasArn =
    process.env.CALL_ASSIST_LEX_BOT_ALIAS_ARN?.trim() ||
    (account ? `arn:aws:lex:${region}:${account}:bot-alias/${lexBotId}/${lexBotAliasId}` : "");
  return {
    agencyId,
    lexBotId,
    lexBotAliasId,
    lexBotAliasArn,
    primaryQueueArn: process.env.CALL_ASSIST_PRIMARY_QUEUE_ARN?.trim() ?? "",
    emergencyQueueArn: process.env.CALL_ASSIST_EMERGENCY_QUEUE_ARN?.trim() ?? "",
    fulfillmentLambdaArn: process.env.CALL_ASSIST_FULFILLMENT_LAMBDA_ARN?.trim() ?? "",
    stage,
  };
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

    if (env.callAssistConnectMock) {
      return `mock-flow-${agencyId}-${stage}`;
    }

    const instanceId = env.connectInstanceId || process.env.CONNECT_INSTANCE_ID?.trim() || "";
    if (!instanceId) {
      throw new Error("CONNECT_INSTANCE_ID is required when CALL_ASSIST_CONNECT_MOCK=false");
    }

    const params = await resolveFlowParams(agencyId, config, stage);
    if (!params.primaryQueueArn || !params.emergencyQueueArn) {
      throw new Error(
        "CALL_ASSIST_PRIMARY_QUEUE_ARN and CALL_ASSIST_EMERGENCY_QUEUE_ARN are required for live Connect flow create",
      );
    }
    if (!params.lexBotAliasArn || !params.lexBotAliasArn.includes("bot-alias")) {
      throw new Error("Unable to resolve Lex bot alias ARN for contact flow");
    }

    const content = parameterizeContactFlowTemplate(JSON.stringify(contactFlowTemplate), params);
    const name = flowName(agencyId, stage);
    const connect = connectClient();

    const existing = await connect.send(
      new ListContactFlowsCommand({
        InstanceId: instanceId,
        ContactFlowTypes: ["CONTACT_FLOW"],
        MaxResults: 100,
      }),
    );
    const match = (existing.ContactFlowSummaryList ?? []).find((f) => f.Name === name);
    if (match?.Id) {
      await connect.send(
        new UpdateContactFlowContentCommand({
          InstanceId: instanceId,
          ContactFlowId: match.Id,
          Content: content,
        }),
      );
      return match.Id;
    }

    const created = await connect.send(
      new CreateContactFlowCommand({
        InstanceId: instanceId,
        Name: name,
        Type: "CONTACT_FLOW",
        Description: `NexCort iQ Call Assist non-emergency flow for ${agencyId}`,
        Content: content,
      }),
    );
    if (!created.ContactFlowId) {
      throw new Error(`CreateContactFlow returned no id for ${name}`);
    }
    return created.ContactFlowId;
  }
}
