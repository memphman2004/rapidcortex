import { describe, expect, it } from "vitest";
import { isAllowedDragTarget } from "./content-protection-drag";

describe("isAllowedDragTarget", () => {
  it("allows drag from a Kanban card with draggable=true", () => {
    const card = document.createElement("button");
    card.setAttribute("draggable", "true");
    const child = document.createElement("span");
    card.appendChild(child);
    expect(isAllowedDragTarget(child)).toBe(true);
    expect(isAllowedDragTarget(card)).toBe(true);
  });

  it("allows drag from data-allow-drag markers", () => {
    const el = document.createElement("div");
    el.setAttribute("data-allow-drag", "true");
    expect(isAllowedDragTarget(el)).toBe(true);
  });

  it("blocks free-text drag from ordinary content", () => {
    const p = document.createElement("p");
    p.textContent = "confidential";
    expect(isAllowedDragTarget(p)).toBe(false);
  });
});
