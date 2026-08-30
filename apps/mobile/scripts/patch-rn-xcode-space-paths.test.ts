import { describe, expect, it } from "vitest";
import {
  patchExConstantsScript,
  patchGetAppConfigIosSh,
  patchPodsPbxproj,
  patchScriptPhasesRb,
  patchWithEnvironmentSh,
  QUOTED_CODEGEN,
  QUOTED_EXCONSTANTS,
  UNQUOTED_CODEGEN,
  UNQUOTED_EXCONSTANTS,
} from "./patch-rn-xcode-space-paths.js";

describe("patch-rn-xcode-space-paths", () => {
  it("quotes codegen invocation so paths with spaces survive /bin/sh -c", () => {
    const src = `        WITH_ENVIRONMENT="$RCT_SCRIPT_RN_DIR/scripts/xcode/with-environment.sh"\n        ${UNQUOTED_CODEGEN}\n`;
    const once = patchScriptPhasesRb(src);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain(QUOTED_CODEGEN);
    expect(once.contents).not.toContain(UNQUOTED_CODEGEN);
    expect(patchScriptPhasesRb(once.contents).changed).toBe(false);
  });

  it("quotes with-environment.sh command execution", () => {
    const src = `# Execute argument, if present\nif [ -n "$1" ]; then\n  $1\nfi\n`;
    const once = patchWithEnvironmentSh(src);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain('  "$@"\n');
    expect(once.contents).not.toMatch(/\n  \$1\n/);
    expect(patchWithEnvironmentSh(once.contents).changed).toBe(false);
  });

  it("quotes the CocoaPods-escaped pbxproj script", () => {
    const src =
      'shellScript = "...\\n/bin/sh -c \\"$WITH_ENVIRONMENT $SCRIPT_PHASES_SCRIPT\\"\\n";';
    const once = patchPodsPbxproj(src);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain(
      '/bin/bash \\"$WITH_ENVIRONMENT\\" \\"$SCRIPT_PHASES_SCRIPT\\"',
    );
    expect(patchPodsPbxproj(once.contents).changed).toBe(false);
  });

  it("quotes EXConstants bash -l -c so paths with spaces survive", () => {
    const once = patchExConstantsScript(UNQUOTED_EXCONSTANTS);
    expect(once.changed).toBe(true);
    expect(once.contents).toBe(QUOTED_EXCONSTANTS);
    expect(patchExConstantsScript(once.contents).changed).toBe(false);
  });

  it("quotes EXConstants in CocoaPods-escaped pbxproj", () => {
    const src =
      'shellScript = "bash -l -c \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"";';
    const once = patchPodsPbxproj(src);
    expect(once.changed).toBe(true);
    expect(once.contents).toContain(
      'bash -l \\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\"',
    );
    expect(once.contents).not.toContain("bash -l -c \\");
    expect(patchPodsPbxproj(once.contents).changed).toBe(false);
  });

  it("quotes basename $PROJECT_DIR in get-app-config-ios.sh", () => {
    const src = "PROJECT_DIR_BASENAME=$(basename $PROJECT_DIR)\n";
    const once = patchGetAppConfigIosSh(src);
    expect(once.changed).toBe(true);
    expect(once.contents).toBe(
      'PROJECT_DIR_BASENAME=$(basename "$PROJECT_DIR")\n',
    );
    expect(patchGetAppConfigIosSh(once.contents).changed).toBe(false);
  });
});
