import { describe, expect, it } from "vitest";
import { GOOGLE_NEST_TM, RING_TM, WYZE_TM, joinTrademarkList } from "./brand-marks";

describe("joinTrademarkList", () => {
  it("omits disabled brands", () => {
    expect(joinTrademarkList([false && RING_TM, GOOGLE_NEST_TM, WYZE_TM])).toBe(
      `${GOOGLE_NEST_TM} and ${WYZE_TM}`,
    );
  });
});
