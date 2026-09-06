import { randomUUID } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { DecryptCommand, EncryptCommand, KMSClient } from "@aws-sdk/client-kms";
import {
  CreateSecretCommand,
  GetSecretValueCommand,
  PutSecretValueCommand,
  SecretsManagerClient,
} from "@aws-sdk/client-secrets-manager";
import type {
  CadAuthType,
  CadConnectorConfig,
  CadFieldMapping,
  CadHealthCheckResult,
  CadRoutingRule,
  CadConnectorCreateBody,
} from "rapid-cortex-shared";
import type { ResolvedCadCredentials } from "../adapter/CadAdapter.js";
import {
  AGENCY_ROUTING_CONNECTOR_ID,
  cadConnectorKmsKeyId,
  cadConnectorSecretsPrefix,
  cadConnectorTableNames,
  isCadConnectorMock,
} from "../env.js";
import { defaultMappingsForVendor } from "../adapters/default-mappings.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export type CadConnectorCreateInput = {
  vendorId: CadConnectorConfig["vendorId"];
  displayName: string;
  department: CadConnectorConfig["department"];
  connectionMode: CadConnectorConfig["connectionMode"];
  pollingIntervalSeconds?: number;
  baseUrl: string;
  authType: CadAuthType;
  apiKey?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  clientCert?: string;
  clientKey?: string;
  fieldMappings?: CadConnectorCreateBody["fieldMappings"];
  routingRules?: CadConnectorCreateBody["routingRules"];
  enabled?: boolean;
};

export type CadConnectorStored = CadConnectorConfig & {
  baseUrlEncrypted: string;
  lastSyncAt?: string;
};

function connectorsTable(): string {
  const name = cadConnectorTableNames().connectors;
  if (!name) throw new Error("CAD_CONNECTORS_TABLE is not set");
  return name;
}

function secretPayload(input: {
  authType: CadAuthType;
  apiKey?: string;
  username?: string;
  password?: string;
  accessToken?: string;
  clientCert?: string;
  clientKey?: string;
  baseUrl: string;
}): string {
  return JSON.stringify({
    authType: input.authType,
    apiKey: input.apiKey,
    username: input.username,
    password: input.password,
    accessToken: input.accessToken,
    clientCert: input.clientCert,
    clientKey: input.clientKey,
    baseUrl: input.baseUrl,
  });
}

async function encryptBaseUrl(plain: string): Promise<string> {
  if (isCadConnectorMock() || !cadConnectorKmsKeyId()) {
    return `mock:${Buffer.from(plain, "utf8").toString("base64")}`;
  }
  const kms = new KMSClient({});
  const out = await kms.send(
    new EncryptCommand({
      KeyId: cadConnectorKmsKeyId(),
      Plaintext: Buffer.from(plain, "utf8"),
    }),
  );
  return Buffer.from(out.CiphertextBlob ?? new Uint8Array()).toString("base64");
}

async function decryptBaseUrl(cipher: string): Promise<string> {
  if (cipher.startsWith("mock:")) {
    return Buffer.from(cipher.slice("mock:".length), "base64").toString("utf8");
  }
  const kms = new KMSClient({});
  const out = await kms.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(cipher, "base64"),
      KeyId: cadConnectorKmsKeyId() || undefined,
    }),
  );
  return Buffer.from(out.Plaintext ?? new Uint8Array()).toString("utf8");
}

function toConfig(item: CadConnectorStored, baseUrl?: string): CadConnectorConfig {
  return {
    connectorId: item.connectorId,
    agencyId: item.agencyId,
    vendorId: item.vendorId,
    displayName: item.displayName,
    department: item.department,
    enabled: item.enabled,
    connectionMode: item.connectionMode,
    pollingIntervalSeconds: item.pollingIntervalSeconds,
    baseUrl,
    credentials: item.credentials,
    fieldMappings: item.fieldMappings ?? [],
    routingRules: item.routingRules ?? [],
    lastHealthCheck: item.lastHealthCheck,
    lastSyncAt: item.lastSyncAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    createdByUserId: item.createdByUserId,
    deletedAt: item.deletedAt,
  };
}

export function sanitizeConnectorForClient(config: CadConnectorConfig): Record<string, unknown> {
  return {
    connectorId: config.connectorId,
    agencyId: config.agencyId,
    vendorId: config.vendorId,
    displayName: config.displayName,
    department: config.department,
    enabled: config.enabled,
    connectionMode: config.connectionMode,
    pollingIntervalSeconds: config.pollingIntervalSeconds,
    credentials: { authType: config.credentials.authType, configured: true },
    fieldMappings: config.fieldMappings,
    routingRules: config.routingRules,
    lastHealthCheck: config.lastHealthCheck,
    lastSyncAt: config.lastSyncAt,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    createdByUserId: config.createdByUserId,
  };
}

/**
 * CRUD for CadConnectorConfig. Encrypts baseUrl with KMS. Stores credentials in
 * Secrets Manager. Never serializes plaintext credentials or baseUrl to clients.
 */
export class CadConnectorService {
  async list(agencyId: string): Promise<CadConnectorConfig[]> {
    const result = await ddb.send(
      new QueryCommand({
        TableName: connectorsTable(),
        KeyConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": agencyId.trim() },
      }),
    );
    return (result.Items ?? [])
      .map((item) => toConfig(item as CadConnectorStored))
      .filter((row) => !row.deletedAt && row.connectorId !== AGENCY_ROUTING_CONNECTOR_ID);
  }

  private async getStored(agencyId: string, connectorId: string): Promise<CadConnectorStored | null> {
    const result = await ddb.send(
      new GetCommand({
        TableName: connectorsTable(),
        Key: { agencyId: agencyId.trim(), connectorId: connectorId.trim() },
      }),
    );
    const item = result.Item as CadConnectorStored | undefined;
    if (!item || item.agencyId !== agencyId.trim() || item.deletedAt) return null;
    return item;
  }

  async get(agencyId: string, connectorId: string): Promise<CadConnectorConfig | null> {
    const item = await this.getStored(agencyId, connectorId);
    return item ? toConfig(item) : null;
  }

  async getResolved(agencyId: string, connectorId: string): Promise<CadConnectorConfig | null> {
    const item = await this.getStored(agencyId, connectorId);
    if (!item) return null;
    const baseUrl = item.baseUrlEncrypted ? await decryptBaseUrl(item.baseUrlEncrypted) : undefined;
    return toConfig(item, baseUrl);
  }

  async create(
    agencyId: string,
    createdByUserId: string,
    input: CadConnectorCreateInput,
  ): Promise<CadConnectorConfig> {
    const now = new Date().toISOString();
    const connectorId = `cadc_${randomUUID()}`;
    const polling =
      input.connectionMode === "polling" ? Math.max(30, input.pollingIntervalSeconds ?? 60) : input.pollingIntervalSeconds;
    const secretArn = await this.putCredentials(agencyId, connectorId, input);
    const item: CadConnectorStored = {
      connectorId,
      agencyId: agencyId.trim(),
      vendorId: input.vendorId,
      displayName: input.displayName,
      department: input.department,
      enabled: input.enabled ?? false,
      connectionMode: input.connectionMode,
      pollingIntervalSeconds: polling,
      credentials: { authType: input.authType, secretArn },
      fieldMappings: (input.fieldMappings?.length
        ? input.fieldMappings
        : defaultMappingsForVendor(input.vendorId)
      ).map((mapping, index) => ({
        ...mapping,
        mappingId: mapping.mappingId ?? `map_${index}`,
        required: mapping.required ?? false,
        direction: mapping.direction ?? "both",
      })),
      routingRules: (input.routingRules ?? []).map((rule, index) => ({
        ...rule,
        ruleId: rule.ruleId ?? `cadr_${index}`,
      })),
      createdAt: now,
      updatedAt: now,
      createdByUserId,
      baseUrlEncrypted: await encryptBaseUrl(input.baseUrl),
    };
    await ddb.send(
      new PutCommand({
        TableName: connectorsTable(),
        Item: item,
        ConditionExpression: "attribute_not_exists(agencyId) AND attribute_not_exists(connectorId)",
      }),
    );
    return toConfig(item);
  }

  async update(
    agencyId: string,
    connectorId: string,
    patch: Partial<CadConnectorCreateInput> & { enabled?: boolean },
  ): Promise<CadConnectorConfig | null> {
    const stored = await this.getStored(agencyId, connectorId);
    if (!stored) return null;
    const now = new Date().toISOString();
    let secretArn = stored.credentials.secretArn;
    const existingBase = stored.baseUrlEncrypted ? await decryptBaseUrl(stored.baseUrlEncrypted) : "";
    const nextBase = patch.baseUrl ?? existingBase;
    if (
      patch.apiKey ||
      patch.username ||
      patch.password ||
      patch.accessToken ||
      patch.clientCert ||
      patch.clientKey ||
      patch.authType ||
      patch.baseUrl
    ) {
      secretArn = await this.putCredentials(agencyId, connectorId, {
        authType: patch.authType ?? stored.credentials.authType,
        apiKey: patch.apiKey,
        username: patch.username,
        password: patch.password,
        accessToken: patch.accessToken,
        clientCert: patch.clientCert,
        clientKey: patch.clientKey,
        baseUrl: nextBase,
      });
    }
    const pollingSeconds =
      (patch.connectionMode ?? stored.connectionMode) === "polling"
        ? Math.max(30, patch.pollingIntervalSeconds ?? stored.pollingIntervalSeconds ?? 60)
        : patch.pollingIntervalSeconds ?? stored.pollingIntervalSeconds;
    const merged: CadConnectorStored = {
      ...stored,
      displayName: patch.displayName ?? stored.displayName,
      department: patch.department ?? stored.department,
      connectionMode: patch.connectionMode ?? stored.connectionMode,
      pollingIntervalSeconds: pollingSeconds,
      enabled: patch.enabled ?? stored.enabled,
      credentials: {
        authType: patch.authType ?? stored.credentials.authType,
        secretArn,
      },
      updatedAt: now,
      baseUrlEncrypted: patch.baseUrl ? await encryptBaseUrl(patch.baseUrl) : stored.baseUrlEncrypted,
    };
    await ddb.send(
      new PutCommand({
        TableName: connectorsTable(),
        Item: merged,
        ConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": agencyId.trim() },
      }),
    );
    return toConfig(merged);
  }

  async softDelete(agencyId: string, connectorId: string): Promise<boolean> {
    const existing = await this.get(agencyId, connectorId);
    if (!existing) return false;
    const deletedAt = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: connectorsTable(),
        Key: { agencyId: agencyId.trim(), connectorId: connectorId.trim() },
        UpdateExpression: "SET deletedAt = :deletedAt, enabled = :enabled, updatedAt = :updatedAt",
        ConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: {
          ":deletedAt": deletedAt,
          ":enabled": false,
          ":updatedAt": deletedAt,
          ":agencyId": agencyId.trim(),
        },
      }),
    );
    return true;
  }

  async setEnabled(agencyId: string, connectorId: string, enabled: boolean): Promise<CadConnectorConfig | null> {
    return this.update(agencyId, connectorId, { enabled });
  }

  async replaceMappings(
    agencyId: string,
    connectorId: string,
    mappings: CadFieldMapping[],
  ): Promise<CadConnectorConfig | null> {
    const existingStored = await this.get(agencyId, connectorId);
    if (!existingStored) return null;
    const now = new Date().toISOString();
    await ddb.send(
      new UpdateCommand({
        TableName: connectorsTable(),
        Key: { agencyId: agencyId.trim(), connectorId: connectorId.trim() },
        UpdateExpression: "SET fieldMappings = :m, updatedAt = :u",
        ConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: {
          ":m": mappings,
          ":u": now,
          ":agencyId": agencyId.trim(),
        },
      }),
    );
    return this.get(agencyId, connectorId);
  }

  async getAgencyRoutingRules(agencyId: string): Promise<CadRoutingRule[]> {
    const result = await ddb.send(
      new GetCommand({
        TableName: connectorsTable(),
        Key: { agencyId: agencyId.trim(), connectorId: AGENCY_ROUTING_CONNECTOR_ID },
      }),
    );
    const item = result.Item as CadConnectorStored | undefined;
    if (!item || item.agencyId !== agencyId.trim()) return [];
    return item.routingRules ?? [];
  }

  async replaceAgencyRoutingRules(agencyId: string, rules: CadRoutingRule[], actorId: string): Promise<CadRoutingRule[]> {
    const now = new Date().toISOString();
    const existing = await ddb.send(
      new GetCommand({
        TableName: connectorsTable(),
        Key: { agencyId: agencyId.trim(), connectorId: AGENCY_ROUTING_CONNECTOR_ID },
      }),
    );
    const prior = existing.Item as CadConnectorStored | undefined;
    const item: CadConnectorStored = {
      connectorId: AGENCY_ROUTING_CONNECTOR_ID,
      agencyId: agencyId.trim(),
      vendorId: "generic_rest",
      displayName: "Agency routing",
      department: "combined_all",
      enabled: false,
      connectionMode: "polling",
      credentials: { authType: "api_key", secretArn: "arn:aws:secretsmanager:us-east-1:000000000000:secret:mock/cad-routing" },
      fieldMappings: [],
      routingRules: rules,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
      createdByUserId: prior?.createdByUserId ?? actorId,
      baseUrlEncrypted: "mock:",
    };
    await ddb.send(
      new PutCommand({
        TableName: connectorsTable(),
        Item: item,
        ConditionExpression: "attribute_not_exists(agencyId) OR agencyId = :agencyId",
        ExpressionAttributeValues: { ":agencyId": agencyId.trim() },
      }),
    );
    return rules;
  }

  async updateHealth(agencyId: string, connectorId: string, health: CadHealthCheckResult): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: connectorsTable(),
        Key: { agencyId: agencyId.trim(), connectorId: connectorId.trim() },
        UpdateExpression: "SET lastHealthCheck = :h, lastHealthStatus = :s, lastHealthAt = :a, updatedAt = :u",
        ConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: {
          ":h": health,
          ":s": health.status,
          ":a": health.checkedAt,
          ":u": health.checkedAt,
          ":agencyId": agencyId.trim(),
        },
      }),
    );
  }

  async touchLastSync(agencyId: string, connectorId: string, lastSyncAt: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: connectorsTable(),
        Key: { agencyId: agencyId.trim(), connectorId: connectorId.trim() },
        UpdateExpression: "SET lastSyncAt = :s, updatedAt = :s",
        ConditionExpression: "agencyId = :agencyId",
        ExpressionAttributeValues: { ":s": lastSyncAt, ":agencyId": agencyId.trim() },
      }),
    );
  }

  async resolveCredentials(config: CadConnectorConfig): Promise<ResolvedCadCredentials> {
    if (isCadConnectorMock()) {
      return { authType: config.credentials.authType, apiKey: "mock" };
    }
    const sm = new SecretsManagerClient({});
    const out = await sm.send(new GetSecretValueCommand({ SecretId: config.credentials.secretArn }));
    const parsed = JSON.parse(out.SecretString ?? "{}") as Record<string, unknown>;
    return {
      authType: config.credentials.authType,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : undefined,
      username: typeof parsed.username === "string" ? parsed.username : undefined,
      password: typeof parsed.password === "string" ? parsed.password : undefined,
      accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : undefined,
      clientCert: typeof parsed.clientCert === "string" ? parsed.clientCert : undefined,
      clientKey: typeof parsed.clientKey === "string" ? parsed.clientKey : undefined,
    };
  }

  async listEnabledPollingConnectors(): Promise<CadConnectorConfig[]> {
    const items: CadConnectorStored[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await ddb.send(
        new ScanCommand({
          TableName: connectorsTable(),
          ExclusiveStartKey: startKey,
          FilterExpression:
            "enabled = :enabled AND connectionMode = :mode AND attribute_not_exists(deletedAt) AND connectorId <> :routing",
          ExpressionAttributeValues: {
            ":enabled": true,
            ":mode": "polling",
            ":routing": AGENCY_ROUTING_CONNECTOR_ID,
          },
        }),
      );
      items.push(...((page.Items ?? []) as CadConnectorStored[]));
      startKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (startKey);
    const resolved: CadConnectorConfig[] = [];
    for (const item of items) {
      const baseUrl = item.baseUrlEncrypted ? await decryptBaseUrl(item.baseUrlEncrypted) : undefined;
      resolved.push(toConfig(item, baseUrl));
    }
    return resolved;
  }

  async listEnabledConnectors(): Promise<CadConnectorConfig[]> {
    const items: CadConnectorStored[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const page = await ddb.send(
        new ScanCommand({
          TableName: connectorsTable(),
          ExclusiveStartKey: startKey,
          FilterExpression:
            "enabled = :enabled AND attribute_not_exists(deletedAt) AND connectorId <> :routing",
          ExpressionAttributeValues: {
            ":enabled": true,
            ":routing": AGENCY_ROUTING_CONNECTOR_ID,
          },
        }),
      );
      items.push(...((page.Items ?? []) as CadConnectorStored[]));
      startKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
    } while (startKey);
    const resolved: CadConnectorConfig[] = [];
    for (const item of items) {
      const baseUrl = item.baseUrlEncrypted ? await decryptBaseUrl(item.baseUrlEncrypted) : undefined;
      resolved.push(toConfig(item, baseUrl));
    }
    return resolved;
  }

  private async putCredentials(
    agencyId: string,
    connectorId: string,
    input: {
      authType: CadAuthType;
      apiKey?: string;
      username?: string;
      password?: string;
      accessToken?: string;
      clientCert?: string;
      clientKey?: string;
      baseUrl: string;
    },
  ): Promise<string> {
    if (isCadConnectorMock()) {
      return `arn:aws:secretsmanager:us-east-1:000000000000:secret:mock/cad/${agencyId}/${connectorId}`;
    }
    const name = `${cadConnectorSecretsPrefix()}/${agencyId}/${connectorId}`;
    const sm = new SecretsManagerClient({});
    const body = secretPayload(input);
    try {
      const created = await sm.send(
        new CreateSecretCommand({
          Name: name,
          SecretString: body,
          Description: "CAD connector credentials — do not store in DynamoDB",
        }),
      );
      return created.ARN ?? name;
    } catch (err) {
      const nameAlready =
        err && typeof err === "object" && "name" in err && String((err as { name: string }).name).includes("Already");
      if (!nameAlready) throw err;
      await sm.send(new PutSecretValueCommand({ SecretId: name, SecretString: body }));
      return name;
    }
  }
}

export const cadConnectorService = new CadConnectorService();
