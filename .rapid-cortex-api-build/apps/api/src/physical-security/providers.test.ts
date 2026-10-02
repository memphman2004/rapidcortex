import { describe, expect, it } from "vitest";
import {
  genetecSecurityCenterProvider,
  honeywellProWatchProvider,
  mockPhysicalSecurityProvider,
  PhysicalSecurityCommandNotImplementedError,
} from "./providers.js";

describe("physical security command adapters", () => {
  it("stubs Genetec, Honeywell, and mock lock/unlock as 501", () => {
    expect(() => genetecSecurityCenterProvider.lockDoors("a", ["d1"], "token")).toThrow(
      PhysicalSecurityCommandNotImplementedError,
    );
    try {
      honeywellProWatchProvider.unlockDoors("a", ["d1"], "token");
      expect.unreachable("Honeywell unlock should throw");
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 501 });
    }
    try {
      mockPhysicalSecurityProvider.revokeCredential("a", "cred", "token");
      expect.unreachable("mock revoke should throw");
    } catch (err) {
      expect(err).toMatchObject({ statusCode: 501 });
    }
  });
});
