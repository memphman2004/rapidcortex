/**
 * Seed default agency SMS keywords (does not overwrite existing rows).
 *
 *   AGENCY_ID=kcpd KEYWORD_TABLE=rapid-cortex-agency-keywords-dev \
 *     npx tsx apps/api/src/call-assist/sms-channel/seed-keywords.ts
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const agencyId = process.env.AGENCY_ID?.trim();
const tableName = process.env.KEYWORD_TABLE?.trim();

if (!agencyId) {
  throw new Error("AGENCY_ID is required (e.g. AGENCY_ID=kcpd)");
}
if (!tableName) {
  throw new Error("KEYWORD_TABLE is required (e.g. KEYWORD_TABLE=rapid-cortex-agency-keywords-dev)");
}

const DEFAULT_KEYWORDS: Array<{ keyword: string; response: string }> = [
  {
    keyword: "TRASH",
    response:
      "For trash and recycling schedules or to report a missed pickup, reply with your street address and we'll log a request.",
  },
  {
    keyword: "PARKS",
    response:
      "City parks are open dawn to dusk. To report a parks issue, describe it and we'll get it to the right department.",
  },
  {
    keyword: "WATER",
    response:
      "No current water outages on file. To report a water issue, describe what you're seeing and we'll create a request.",
  },
  {
    keyword: "PAY",
    response:
      "Pay bills and fees online at [agency website]. Questions about your bill? Describe your concern and we'll help.",
  },
  {
    keyword: "HOURS",
    response:
      "Most city offices are open Mon–Fri 8 AM–5 PM. For a specific department's hours, text the department name.",
  },
];

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

async function main(): Promise<void> {
  const now = new Date().toISOString();
  for (const row of DEFAULT_KEYWORDS) {
    const keyword = row.keyword.toUpperCase();
    try {
      await ddb.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            PK: `AGENCY#${agencyId}`,
            SK: `KEYWORD#${keyword}`,
            keyword,
            response: row.response,
            isActive: true,
            updatedAt: now,
          },
          ConditionExpression: "attribute_not_exists(PK)",
        }),
      );
      console.log(`seeded ${keyword}`);
    } catch (err: unknown) {
      const name = err && typeof err === "object" && "name" in err ? String(err.name) : "";
      if (name === "ConditionalCheckFailedException") {
        console.log(`skipped ${keyword} (already exists)`);
        continue;
      }
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
