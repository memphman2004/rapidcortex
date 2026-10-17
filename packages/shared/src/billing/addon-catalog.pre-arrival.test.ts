import { describe, expect, it } from "vitest";
import { ADDON_CATALOG, getAddonByKey } from "./addon-catalog.js";

describe("Pre-Arrival iQ Pro catalog SKU", () => {
  it("registers Pre-Arrival iQ Pro under Caller Media", () => {
    const pro = getAddonByKey("caller_media.pre_arrival_iq");
    expect(pro.name).toMatch(/Pre-Arrival iQ Pro/i);
    expect(pro.category).toBe("Caller Media");
    expect(pro.monthlyPrice).toBe(4500);
  });

  it("keeps SMS-link and text-only as a la carte precursors", () => {
    const sms = getAddonByKey("caller_media.sms_link");
    const text = getAddonByKey("caller_media.text_conversation");
    expect(sms.name.toLowerCase()).toContain("a la carte");
    expect(text.name.toLowerCase()).toContain("a la carte");
    expect(ADDON_CATALOG.some((a) => a.key === "caller_media.pre_arrival_iq")).toBe(true);
  });
});
