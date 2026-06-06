import "server-only";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { AgencyConfigRepository, AgencyConfigPatch } from "@/lib/rapid-cortex/agency/AgencyConfigRepository";
import {
  defaultAgencyConfigRecord,
  enforceAutomatedWriteBackSafety,
  type AgencyConfigRecord,
} from "@/lib/rapid-cortex/agency/defaultAgencyConfig";
import { FileAgencyConfigRepository } from "@/lib/rapid-cortex/agency/FileAgencyConfigRepository";

/**
 * DynamoDB persistence for {@link AgencyConfigRecord}.
 * Table: single-table, PK = `agencyId` (string). No GSI required for v1.
 *
 * Create table (example):
 *   aws dynamodb create-table --table-name rapid-cortex-agency-config
 *     --attribute-definitions AttributeName=agencyId,AttributeType=S
 *     --key-schema AttributeName=agencyId,KeyType=HASH
 *     --billing-mode PAY_PER_REQUEST
 */
export class DynamoAgencyConfigRepository implements AgencyConfigRepository {
  private readonly tableName: string;
  private readonly doc: DynamoDBDocumentClient;

  constructor() {
    const name = process.env.AGENCY_CONFIG_TABLE_NAME?.trim();
    if (!name) {
      throw new Error("DynamoAgencyConfigRepository requires AGENCY_CONFIG_TABLE_NAME");
    }
    this.tableName = name;
    const client = new DynamoDBClient(
      process.env.AWS_REGION
        ? { region: process.env.AWS_REGION }
        : {},
    );
    this.doc = DynamoDBDocumentClient.from(client);
  }

  async enableFeature(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord> {
    const base = (await this.getAgencyConfig(agencyId)) ?? defaultAgencyConfigRecord(agencyId);
    return this.patchAgencyConfig(
      agencyId,
      { disabledFeatures: base.disabledFeatures.filter((x) => x !== featureId) },
      updatedBy,
    );
  }

  async disableFeature(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord> {
    const base = (await this.getAgencyConfig(agencyId)) ?? defaultAgencyConfigRecord(agencyId);
    if (base.disabledFeatures.includes(featureId)) {
      return base;
    }
    return this.patchAgencyConfig(agencyId, { disabledFeatures: [...base.disabledFeatures, featureId] }, updatedBy);
  }

  async enableAddOn(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord> {
    const base = (await this.getAgencyConfig(agencyId)) ?? defaultAgencyConfigRecord(agencyId);
    if (base.enabledAddOns.includes(featureId)) {
      return base;
    }
    return this.patchAgencyConfig(agencyId, { enabledAddOns: [...base.enabledAddOns, featureId] }, updatedBy);
  }

  async disableAddOn(agencyId: string, featureId: string, updatedBy?: string): Promise<AgencyConfigRecord> {
    const base = (await this.getAgencyConfig(agencyId)) ?? defaultAgencyConfigRecord(agencyId);
    if (!base.enabledAddOns.includes(featureId)) {
      return base;
    }
    return this.patchAgencyConfig(
      agencyId,
      { enabledAddOns: base.enabledAddOns.filter((x) => x !== featureId) },
      updatedBy,
    );
  }

  private applyPatch(
    current: AgencyConfigRecord,
    patch: AgencyConfigPatch,
    updatedBy: string | undefined,
  ): AgencyConfigRecord {
    const mode = patch.cadIntegrationMode ?? current.cadIntegrationMode;
    const now = new Date().toISOString();
    return {
      ...current,
      ...patch,
      enabledAddOns: patch.enabledAddOns ?? current.enabledAddOns,
      limitedFeatureOverrides: patch.limitedFeatureOverrides ?? current.limitedFeatureOverrides,
      disabledFeatures: patch.disabledFeatures ?? current.disabledFeatures,
      cadIntegrationMode: enforceAutomatedWriteBackSafety(mode),
      writeBackEnabled: patch.writeBackEnabled ?? current.writeBackEnabled,
      agencyApprovedCadWriteBack: patch.agencyApprovedCadWriteBack ?? current.agencyApprovedCadWriteBack,
      auditLoggingEnabled: patch.auditLoggingEnabled ?? current.auditLoggingEnabled,
      sandboxMode: patch.sandboxMode ?? current.sandboxMode,
      updatedAt: now,
      updatedBy: updatedBy ?? current.updatedBy,
    };
  }

  async getAgencyConfig(agencyId: string): Promise<AgencyConfigRecord | null> {
    const out = await this.doc.send(
      new GetCommand({ TableName: this.tableName, Key: { agencyId } }),
    );
    if (!out.Item) return null;
    return out.Item as AgencyConfigRecord;
  }

  async upsertAgencyConfig(config: AgencyConfigRecord): Promise<AgencyConfigRecord> {
    const safe: AgencyConfigRecord = {
      ...config,
      cadIntegrationMode: enforceAutomatedWriteBackSafety(config.cadIntegrationMode),
    };
    await this.doc.send(
      new PutCommand({
        TableName: this.tableName,
        Item: safe,
      }),
    );
    return safe;
  }

  async patchAgencyConfig(
    agencyId: string,
    patch: AgencyConfigPatch,
    updatedBy?: string,
  ): Promise<AgencyConfigRecord> {
    const existing = (await this.getAgencyConfig(agencyId)) ?? defaultAgencyConfigRecord(agencyId);
    const next = this.applyPatch(existing, patch, updatedBy);
    await this.upsertAgencyConfig(next);
    return next;
  }
}

export function createAgencyConfigDynamoOrFile(): AgencyConfigRepository {
  if (process.env.AGENCY_CONFIG_TABLE_NAME?.trim()) {
    return new DynamoAgencyConfigRepository();
  }
  return new FileAgencyConfigRepository();
}
