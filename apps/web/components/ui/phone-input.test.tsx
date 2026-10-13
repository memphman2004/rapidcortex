/** @vitest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { PhoneInput } from "./phone-input";

describe("PhoneInput ANI prefill", () => {
  it("inserts incident callback into the field as formatted US phone", async () => {
    const onChange = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const root = createRoot(el);

    flushSync(() => {
      root.render(<PhoneInput ani="+17065551234" onChange={onChange} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    const input = el.querySelector("input");
    expect(input?.value).toBe("(706) 555-1234");
    expect(onChange).toHaveBeenCalledWith("+17065551234");

    await act(async () => {
      root.unmount();
    });
    el.remove();
  });
});
