import { describe, expect, it } from "vitest";
import {
  bufferPolygonOneMile,
  classifyPointAgainstEnsBoundary,
  pointInPolygon,
} from "./polygon-buffer.js";

describe("polygon-buffer", () => {
  const square: Array<[number, number]> = [
    [-86.0, 39.0],
    [-85.9, 39.0],
    [-85.9, 39.1],
    [-86.0, 39.1],
  ];

  it("detects inside boundary", () => {
    expect(pointInPolygon(-85.95, 39.05, square)).toBe(true);
  });

  it("classifies one-mile ring", () => {
    const outer = bufferPolygonOneMile(square);
    expect(classifyPointAgainstEnsBoundary(-85.95, 39.05, square, outer)).toBe("inside_boundary");
    expect(classifyPointAgainstEnsBoundary(-86.2, 39.05, square, outer)).toBe("outside");
  });
});
