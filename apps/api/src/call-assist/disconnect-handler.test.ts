import { describe, expect, it, vi } from "vitest";
import {
  agencyIdFromDisconnect,
  closeOpenCallAssistSessions,
  contactIdFromDisconnect,
  type DisconnectDoc,
} from "./disconnect-handler.js";

describe("disconnect-handler", () => {
  it("reads contact and agency from Connect event shape", () => {
    expect(
      contactIdFromDisconnect({
        Details: { ContactData: { ContactId: "c-1", Attributes: { agencyId: "kcpd" } } },
      }),
    ).toBe("c-1");
    expect(
      agencyIdFromDisconnect({
        Details: { ContactData: { ContactId: "c-1", Attributes: { agencyId: "kcpd" } } },
      }),
    ).toBe("kcpd");
    expect(agencyIdFromDisconnect({ Details: {} })).toBe("default");
  });

  it("closes an OPEN Lex session as ABANDONED when no confirmation", async () => {
    const puts: unknown[] = [];
    const doc: DisconnectDoc = {
      send: vi.fn(async (command: unknown) => {
        const input = (command as { input?: { Item?: unknown; Key?: { sk?: string } } }).input;
        if (input?.Item) {
          puts.push(input.Item);
          return {};
        }
        if (input?.Key?.sk === "SESSION#c1") {
          return {
            Item: {
              agencyId: "kcpd",
              sessionId: "c1",
              state: "INTAKE",
              createdAt: "2026-11-06T00:00:00.000Z",
              gsi1pk: "kcpd#OPEN",
            },
          };
        }
        return {};
      }),
    };

    process.env.CALL_ASSIST_TABLE = "rapid-cortex-call-assist-test";
    const result = await closeOpenCallAssistSessions({ agencyId: "kcpd", contactId: "c1" }, doc);
    expect(result.lex).toBe("ABANDONED");
    expect(result.nova).toBeNull();
    expect(puts[0]).toMatchObject({ gsi1pk: "kcpd#DONE", disposition: "ABANDONED" });
  });

  it("closes an OPEN Nova session onto DONE GSI", async () => {
    const puts: unknown[] = [];
    const doc: DisconnectDoc = {
      send: vi.fn(async (command: unknown) => {
        const input = (command as { input?: { Item?: unknown; Key?: { sk?: string } } }).input;
        if (input?.Item) {
          puts.push(input.Item);
          return {};
        }
        if (input?.Key?.sk === "SESSION#nova#c2") {
          return {
            Item: {
              agencyId: "kcpd",
              sessionId: "nova#c2",
              sk: "SESSION#nova#c2",
              kind: "nova_sonic",
              contactId: "c2",
              status: "ACTIVE",
              createdAt: "2026-11-06T00:00:00.000Z",
              handoff: { confirmationNumber: "" },
              intake: {},
            },
          };
        }
        return {};
      }),
    };

    process.env.CALL_ASSIST_TABLE = "rapid-cortex-call-assist-test";
    const result = await closeOpenCallAssistSessions({ agencyId: "kcpd", contactId: "c2" }, doc);
    expect(result.nova).toBe("ABANDONED");
    expect(puts[0]).toMatchObject({ gsi1pk: "kcpd#DONE", status: "ERROR" });
  });
});
