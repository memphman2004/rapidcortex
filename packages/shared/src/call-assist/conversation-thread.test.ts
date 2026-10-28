import { describe, expect, it } from "vitest";
import { continueConversation, measurePilotCall, replyWithoutRepeating } from "./conversation-thread.js";
import { buildTransferPackage } from "./transfer-package.js";
import type { CallIntakeData } from "./intake.js";
import type { CallTriageResult } from "./triage.js";
import type { SafetyDecision } from "./safety.js";
import type { RoutingRecommendation } from "./routing.js";

const roadway = "A tree is blocking the roadway";

describe("one conversation across voice, text, and a person", () => {
  it("finishes a blocked roadway without asking for the location twice", () => {
    const started = continueConversation({
      agencyId: "springfield",
      sessionId: "call-1",
      channel: "voice",
      utterance: roadway,
      tenantCity: "Springfield",
    });
    expect(started.outcome).toBe("NEED_LOCATION");

    const located = continueConversation({
      agencyId: "springfield",
      sessionId: "call-1",
      channel: "voice",
      utterance: roadway,
      tenantCity: "Springfield",
      intake: { locationText: "4200 Main Street", jurisdictionMatch: true },
    });
    expect(located.outcome).toBe("NEED_FOLLOW_UP");
    expect(located.nextQuestion).toContain("anyone hurt");
    expect(located.alreadyCollected).toEqual(["Location: 4200 Main Street"]);

    const intake: CallIntakeData = {
      locationText: "4200 Main Street",
      jurisdictionMatch: true,
      injuries: false,
      incidentTypeHint: "blocked roadway",
    };
    const filed = continueConversation({
      agencyId: "springfield",
      sessionId: "call-1",
      channel: "sms",
      utterance: "No one is hurt. The road is still blocked.",
      tenantCity: "Springfield",
      intake,
    });
    expect(filed.outcome).toBe("CREATE_PUBLIC_WORKS");
    const sms = replyWithoutRepeating("What is the address?", filed);
    expect(sms).toContain("4200 Main Street");
    expect(sms.toLowerCase()).not.toContain("what is the address");

    const trapped = continueConversation({
      agencyId: "springfield",
      sessionId: "call-1",
      channel: "voice",
      utterance: "there's a fire and someone is trapped",
      intake,
    });
    expect(trapped.outcome).toBe("TRANSFER_EMERGENCY");
  });

  it("sends an out-of-city roadway to a person and keeps the location", () => {
    const outside = continueConversation({
      agencyId: "springfield",
      sessionId: "call-2",
      channel: "handoff",
      utterance: roadway,
      tenantCity: "Springfield",
      intake: { locationText: "900 County Line Road", jurisdictionMatch: false, injuries: false },
    });
    expect(outside.outcome).toBe("TRANSFER_HUMAN");
    expect(outside.alreadyCollected[0]).toContain("900 County Line Road");
  });

  it("puts the collected facts on the auditable handoff", () => {
    const triage = {
      primaryClassification: "PUBLIC_WORKS",
      continueIntake: false,
    } as CallTriageResult;
    const safety = { action: "CONTINUE", classification: "NON_EMERGENCY", matchedPhrases: [] } as SafetyDecision;
    const routing = {
      destinationType: "CALL_TAKER",
      spokenCallerScript: "I'm transferring you.",
      spokenReceiverSummary: "Road blocked.",
    } as RoutingRecommendation;
    const pack = buildTransferPackage({
      sessionId: "call-1",
      agencyId: "springfield",
      triage,
      safety,
      intake: { locationText: "4200 Main Street", injuries: false },
      routing,
      utterances: ["A tree is blocking the roadway"],
    });
    expect(pack.alreadyCollected).toContain("Location: 4200 Main Street");
    expect(pack.alreadyCollected).toContain("No injuries reported");
  });

  it("scores a finished pilot call", () => {
    const score = measurePilotCall({
      responseLatencyMs: 700,
      bargeInCount: 1,
      outcome: "CREATE_PUBLIC_WORKS",
      expectedOutcome: "CREATE_PUBLIC_WORKS",
      emergencyDetected: false,
      emergencyTransferred: false,
      satisfactionScore: 5,
    });
    expect(score.taskCompleted).toBe(true);
    expect(score.incorrectRouting).toBe(false);
    expect(score.interruptionHandled).toBe(true);
    expect(score.emergencyEscalationReliable).toBeNull();
    expect(score.satisfactionScore).toBe(5);
  });
});
