import { describe, expect, it } from "vitest";
import {
  ensureIncidentPulseImage,
  INCIDENT_PULSE_IMAGE_ID,
} from "./incident-marker-overlay";

describe("incident marker pulse", () => {
  it("registers the animated red pulse image once", () => {
    const images = new Set<string>();
    const map = {
      hasImage: (id: string) => images.has(id),
      addImage: (id: string) => {
        images.add(id);
      },
      triggerRepaint: () => undefined,
    };
    ensureIncidentPulseImage(map as unknown as import("maplibre-gl").Map);
    ensureIncidentPulseImage(map as unknown as import("maplibre-gl").Map);
    expect([...images]).toEqual([INCIDENT_PULSE_IMAGE_ID]);
  });
});
