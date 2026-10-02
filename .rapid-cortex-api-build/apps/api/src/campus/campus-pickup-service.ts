import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function pickupTable(): string {
  const t = process.env.CAMPUS_PICKUP_AUTH_TABLE?.trim();
  if (!t) throw new Error("CAMPUS_PICKUP_AUTH_TABLE not set");
  return t;
}

export const authorizedPickupSchema = z.object({
  personId: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(120),
  relationship: z.string().trim().min(1).max(80),
  phone: z.string().trim().min(7).max(32),
  photoKey: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const studentPickupRecordSchema = z.object({
  agencyId: z.string().trim().min(1),
  studentId: z.string().trim().min(1).max(64),
  studentName: z.string().trim().min(1).max(120),
  grade: z.string().trim().max(32).optional(),
  siteId: z.string().trim().max(64).optional(),
  authorizedPersons: z.array(authorizedPickupSchema).max(20),
  restrictedPersonIds: z.array(z.string().trim().min(1).max(64)).max(50),
  notes: z.string().trim().max(1000).optional(),
  updatedAt: z.string().min(1),
  updatedBy: z.string().min(1),
});

export type StudentPickupRecord = z.infer<typeof studentPickupRecordSchema>;

export async function getPickupRecord(
  agencyId: string,
  studentId: string,
): Promise<StudentPickupRecord | undefined> {
  const result = await ddb.send(
    new GetCommand({
      TableName: pickupTable(),
      Key: { agencyId, studentId },
    }),
  );
  return result.Item as StudentPickupRecord | undefined;
}

export async function listPickupRecords(agencyId: string): Promise<StudentPickupRecord[]> {
  const result = await ddb.send(
    new QueryCommand({
      TableName: pickupTable(),
      KeyConditionExpression: "agencyId = :a",
      ExpressionAttributeValues: { ":a": agencyId },
    }),
  );
  return (result.Items ?? []) as StudentPickupRecord[];
}

export async function upsertPickupRecord(record: StudentPickupRecord): Promise<void> {
  const parsed = studentPickupRecordSchema.parse(record);
  await ddb.send(new PutCommand({ TableName: pickupTable(), Item: parsed }));
}
