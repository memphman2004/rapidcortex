import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

/**
 * DocumentClient `.send` typing breaks when duplicate `@smithy/types` resolve
 * (client-dynamodb vs lib-dynamodb). Runtime is fine — narrow via cast.
 */
export async function docSend<T = Record<string, unknown>>(
  client: DynamoDBDocumentClient,
  command: unknown,
): Promise<T> {
  return client.send(command as never) as Promise<T>;
}
