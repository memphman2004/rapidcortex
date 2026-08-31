import { describe, expect, it } from "vitest";
import {
  patchUserScriptSandboxing,
  QUOTED,
  UNQUOTED,
} from "./with-disable-user-script-sandboxing.js";

describe("with-disable-user-script-sandboxing", () => {
  it("turns off Xcode user script sandboxing so Expo configure can read Pods", () => {
    const src = `				${UNQUOTED}\n				GCC_C_LANGUAGE_STANDARD = gnu99;\n`;
    const once = patchUserScriptSandboxing(src);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain(QUOTED);
    expect(once.contents).not.toContain(UNQUOTED);
    expect(patchUserScriptSandboxing(once.contents).changed).toBe(false);
  });
});
