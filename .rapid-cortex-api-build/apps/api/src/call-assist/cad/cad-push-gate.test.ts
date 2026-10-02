import { describe, expect, it } from "vitest";
import { evaluateCadPushGate } from "./provider.js";
import { emergencyTransferAction } from "../telephony/provider.js";
import { evaluateRmsDraftGate } from "../rms/rms-draft.js";

describe("Call Assist CAD push gate", () => {
  it("blocks when platform CAD write-back is off", () => {
    const r = evaluateCadPushGate({
      cadWritebackEnabled: false,
      callAssistCadPushEnabled: true,
      humanReviewRequired: true,
      humanReviewApproved: true,
      demo: false,
    });
    expect(r?.blocked).toBe(true);
    expect(r?.reason).toBe("cad_writeback_disabled");
  });

  it("blocks when Call Assist CAD push flag is off", () => {
    const r = evaluateCadPushGate({
      cadWritebackEnabled: true,
      callAssistCadPushEnabled: false,
      humanReviewRequired: true,
      humanReviewApproved: true,
      demo: false,
    });
    expect(r?.blocked).toBe(true);
    expect(r?.reason).toBe("call_assist_cad_push_disabled");
  });

  it("requires human review before live create", () => {
    const r = evaluateCadPushGate({
      cadWritebackEnabled: true,
      callAssistCadPushEnabled: true,
      humanReviewRequired: true,
      humanReviewApproved: false,
      demo: false,
    });
    expect(r?.pendingReview).toBe(true);
    expect(r?.blocked).toBe(false);
  });

  it("demo never uses live 911 or live CAD vendor", () => {
    const cad = evaluateCadPushGate({
      cadWritebackEnabled: false,
      callAssistCadPushEnabled: false,
      humanReviewRequired: true,
      humanReviewApproved: false,
      demo: true,
    });
    expect(cad?.vendor).toBe("mock");
    expect(cad?.reason).toBe("demo_mock_cad");
    const tel = emergencyTransferAction(
      { liveEmergencyNumber: "911", demoEmergencyNumber: "+15555550111" },
      { demo: true, spokenCallerScript: "transferring" },
    );
    expect(tel.action).toBe("TRANSFER_911");
    expect(tel.continueAiConversation).toBe(false);
    expect(tel.destinationNumber).toBe("+15555550111");
  });
});

describe("Call Assist RMS draft gate", () => {
  it("is fail-closed when the RMS flag is unset", () => {
    const r = evaluateRmsDraftGate({
      rmsDraftEnabled: false,
      humanReviewApproved: true,
      demo: false,
    });
    expect(r.blocked).toBe(true);
  });
});
