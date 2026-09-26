import { describe, expect, it } from "vitest";
import {
  buildHospitalHoverHTML,
  hospitalDetailsUrl,
  hospitalDirectionsUrl,
  hospitalFacilityLabel,
  hospitalPropsFromFeature,
  hospitalTelHref,
} from "./hospital-overlay";

describe("hospital overlay helpers", () => {
  it("builds a hover card with name, address, ER, phone, and distance", () => {
    const html = buildHospitalHoverHTML({
      id: "place-1",
      name: "Piedmont Columbus Regional",
      category: "hospital_emergency_room",
      emergencyRoom: true,
      address: "710 Center St, Columbus, GA",
      phone: "(706) 571-1000",
      distance: "2.4 mi",
      distanceMiles: 2.4,
    });
    expect(html).toContain("Piedmont Columbus Regional");
    expect(html).toContain("710 Center St");
    expect(html).toContain("Emergency Department");
    expect(html).toContain("(706) 571-1000");
    expect(html).toContain("2.4 mi");
  });

  it("omits ER and optional fields when absent", () => {
    const html = buildHospitalHoverHTML({
      id: "clinic",
      name: "Clinic",
      category: "hospital_or_health_care_facility",
      emergencyRoom: false,
      address: "",
      phone: "",
      distance: "",
      distanceMiles: 0,
    });
    expect(html).not.toContain("Emergency Department");
    expect(html).not.toContain("hospital-hover-phone");
  });

  it("normalizes clustered GeoJSON properties and builds action URLs", () => {
    const props = hospitalPropsFromFeature({
      id: "p1",
      name: "Grady Memorial Hospital",
      category: "hospital",
      emergencyRoom: "true",
      address: "80 Jesse Hill Jr Dr SE",
      phone: "(404) 616-1000",
      distance: "1.2 mi",
      distanceMiles: "1.2",
    });
    expect(props.emergencyRoom).toBe(true);
    expect(hospitalFacilityLabel("hospital_or_health_care_facility", false)).toBe("Medical");
    expect(hospitalFacilityLabel("clinic", false)).toBe("Medical");
    expect(hospitalFacilityLabel(props.category, props.emergencyRoom)).toBe("Hospital");
    expect(hospitalTelHref(props.phone)).toBe("tel:4046161000");
    expect(hospitalDirectionsUrl(-84.382, 33.752)).toContain("33.752,-84.382");
    expect(hospitalDetailsUrl(props)).toContain("Grady");
  });
});
