import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./baseRepository.js";
import { env } from "../lib/env.js";

export class LegalHoldRepository {
  async setLegalHold(
    incidentId: string,
    input: {
      legalHold: boolean;
      legalHoldReason: string | null | undefined;
      legalHoldSetBy: string;
      legalHoldSetAt: string;
    },
  ): Promise<void> {
    const reason = input.legalHold ? (input.legalHoldReason?.trim() || "legal_hold") : null;
    if (input.legalHold) {
      await ddb.send(
        new UpdateCommand({
          TableName: env.incidentsTable,
          Key: { incidentId },
          UpdateExpression:
            "SET legalHold = :lh, legalHoldReason = :lr, legalHoldSetBy = :lb, legalHoldSetAt = :la, updatedAt = :u",
          ExpressionAttributeValues: {
            ":lh": true,
            ":lr": reason,
            ":lb": input.legalHoldSetBy,
            ":la": input.legalHoldSetAt,
            ":u": input.legalHoldSetAt,
          },
        }),
      );
    } else {
      await ddb.send(
        new UpdateCommand({
          TableName: env.incidentsTable,
          Key: { incidentId },
          UpdateExpression: "REMOVE legalHold, legalHoldReason, legalHoldSetBy, legalHoldSetAt SET updatedAt = :u",
          ExpressionAttributeValues: {
            ":u": input.legalHoldSetAt,
          },
        }),
      );
    }
  }
}
