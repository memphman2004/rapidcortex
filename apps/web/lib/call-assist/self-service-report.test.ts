import { describe, expect, it } from "vitest";
import {
  decodeSelfServiceToken,
  isSelfServiceTokenShape,
  selfServiceStatusLabel,
} from "./self-service-report";

describe("self-service report token page", () => {
  it("treats missing or truncated tokens as unusable", () => {
    expect(decodeSelfServiceToken(undefined)).toBe("");
    expect(decodeSelfServiceToken("  ")).toBe("");
    expect(isSelfServiceTokenShape("")).toBe(false);
    expect(isSelfServiceTokenShape("short")).toBe(false);
    expect(isSelfServiceTokenShape("tok_live_token_16")).toBe(true);
  });

  it("decodes a path token without throwing on malformed percent encoding", () => {
    expect(decodeSelfServiceToken("abc%2Fdef")).toBe("abc/def");
    expect(decodeSelfServiceToken("%E0%A4%A")).toBe("%E0%A4%A");
  });

  it("labels SMS statuses for the public page", () => {
    expect(selfServiceStatusLabel("CLICKED")).toBe("Opened");
    expect(selfServiceStatusLabel("COMPLETED")).toBe("Marked complete");
    expect(selfServiceStatusLabel(undefined)).toBe("Ready");
  });
});
