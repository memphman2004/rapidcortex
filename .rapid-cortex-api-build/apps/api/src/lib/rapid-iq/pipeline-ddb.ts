import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * Cursor/client for pipeline ingest Lambdas.
 * Do not import `lib/env` / `baseRepository` here — those require INCIDENTS_TABLE
 * and crash county/legistar ingest at init.
 */
export const pipelineDdb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
