import { describe, expect, it } from "vitest";
import { mapApolloEmailerCampaign } from "./apollo-campaigns.js";

describe("mapApolloEmailerCampaign", () => {
  it("keeps Apollo sequence stats and drops an empty id", () => {
    expect(
      mapApolloEmailerCampaign({
        id: "seq-1",
        name: "PSAP intro",
        active: true,
        archived: false,
        num_steps: 4,
        unique_scheduled: "3",
        unique_delivered: 80,
        unique_opened: 20,
        unique_replied: 5,
        unique_clicked: 2,
      }),
    ).toEqual({
      id: "seq-1",
      name: "PSAP intro",
      active: true,
      archived: false,
      steps: 4,
      scheduled: 3,
      delivered: 80,
      opened: 20,
      replied: 5,
      clicked: 2,
    });
    expect(mapApolloEmailerCampaign({ id: "  ", name: "Missing" })).toBeNull();
  });
});
