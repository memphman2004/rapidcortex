import { describe, it, expect, vi, beforeEach } from "vitest";

const send = vi.hoisted(() => vi.fn());

vi.mock("./baseRepository.js", () => ({
  ddb: { send },
}));

import { PremiseNotesRepository } from "./premiseNotesRepository.js";

describe("PremiseNotesRepository", () => {
  const repo = new PremiseNotesRepository();

  beforeEach(() => {
    send.mockReset();
  });

  it("listForAddress queries by agency-scoped composite key", async () => {
    send.mockResolvedValue({
      Items: [
        {
          noteId: "n1",
          text: "Gate",
          createdAt: "2024-01-01T00:00:00.000Z",
          createdByUserId: "u1",
        },
      ],
    });
    const out = await repo.listForAddress("agency-a", "100 main st");
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          KeyConditionExpression: "premiseScopeKey = :k",
          ExpressionAttributeValues: { ":k": "agency-a#100 main st" },
        }),
      }),
    );
    expect(out[0]).toMatchObject({
      noteId: "n1",
      text: "Gate",
      createdBy: "u1",
      source: "manual_note",
    });
  });

  it("createNote writes normalized address under scope key", async () => {
    send.mockResolvedValue({});
    await repo.createNote({
      noteId: "n2",
      agencyId: "agency-a",
      normalizedAddress: "100 main st",
      incidentId: "inc-1",
      text: "Note",
      createdBy: "u1",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Item: expect.objectContaining({
            premiseScopeKey: "agency-a#100 main st",
            noteId: "n2",
            agencyId: "agency-a",
            callerAddressNormalized: "100 main st",
          }),
        }),
      }),
    );
  });
});
