import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";
import type { AgencySharePartnerRecord, AgencySharePartnerStatus } from "rapid-cortex-shared";

export class AgencySharePartnerRepository {
  private table(): string {
    const t = env.agencySharePartnersTable;
    if (!t) throw new Error("AGENCY_SHARE_PARTNERS_DISABLED");
    return t;
  }

  async get(ownerAgencyId: string, partnerAgencyId: string): Promise<AgencySharePartnerRecord | null> {
    const res = await ddb.send(
      new GetCommand({
        TableName: this.table(),
        Key: { ownerAgencyId, partnerAgencyId },
      }),
    );
    return (res.Item as AgencySharePartnerRecord) ?? null;
  }

  async putTrust(record: AgencySharePartnerRecord): Promise<void> {
    await ddb.send(
      new PutCommand({
        TableName: this.table(),
        Item: record,
      }),
    );
  }

  async assertActiveTrust(ownerAgencyId: string, partnerAgencyId: string): Promise<boolean> {
    const row = await this.get(ownerAgencyId, partnerAgencyId);
    return Boolean(row && row.status === "active");
  }

  async revoke(ownerAgencyId: string, partnerAgencyId: string): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { ownerAgencyId, partnerAgencyId },
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": "revoked" },
      }),
    );
  }

  async setStatus(
    ownerAgencyId: string,
    partnerAgencyId: string,
    status: AgencySharePartnerStatus,
  ): Promise<void> {
    await ddb.send(
      new UpdateCommand({
        TableName: this.table(),
        Key: { ownerAgencyId, partnerAgencyId },
        UpdateExpression: "SET #s = :s",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":s": status },
      }),
    );
  }
}
