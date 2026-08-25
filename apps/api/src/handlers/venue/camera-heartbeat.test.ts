import { describe, expect, it } from "vitest";
import { isDynamoTableMissing } from "./camera-heartbeat.js";

describe("isDynamoTableMissing", () => {
  it("matches DynamoDB ResourceNotFoundException by name", () => {
    const error = Object.assign(new Error("Requested resource not found"), {
      name: "ResourceNotFoundException",
    });
    expect(isDynamoTableMissing(error)).toBe(true);
  });

  it("matches DynamoDB ResourceNotFoundException by __type", () => {
    expect(
      isDynamoTableMissing({
        __type: "com.amazonaws.dynamodb.v20120810#ResourceNotFoundException",
        message: "Requested resource not found",
      }),
    ).toBe(true);
  });

  it("does not match other failures", () => {
    expect(isDynamoTableMissing(new Error("KVS timeout"))).toBe(false);
    expect(isDynamoTableMissing(null)).toBe(false);
    expect(isDynamoTableMissing({ name: "AccessDeniedException" })).toBe(false);
  });
});
