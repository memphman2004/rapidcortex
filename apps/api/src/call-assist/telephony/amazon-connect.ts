import {
  emergencyTransferAction,
  type TelephonyAction,
  type TelephonyEmergencyDestinations,
  type TelephonyProvider,
} from "./provider.js";
import { applyBargeIn, detectBargeIn, readBargeInState, type BargeInState } from "./barge-in.js";

/**
 * Amazon Connect is the live TelephonyProvider for Call Assist.
 *
 * Barge-in / interrupt / resume:
 * Lex V2 prompts are imported with allowInterrupt=true. When the caller speaks
 * over TTS, Connect delivers the new utterance with existing Lex slots. Resume
 * keeps those slots and elicits the next missing field (see barge-in.ts).
 *
 * KVS StartMediaStreaming is an optional media fork for Contact Lens / recording,
 * not the barge-in control path. Rapid Cortex does not operate a second 911 SIP switch.
 */
export class AmazonConnectProvider implements TelephonyProvider {
  readonly name = "amazon-connect";

  async emergencyTransfer(
    destinations: TelephonyEmergencyDestinations,
    opts: { demo: boolean; spokenCallerScript: string },
  ): Promise<TelephonyAction> {
    return emergencyTransferAction(destinations, opts);
  }

  async warmTransfer(opts: {
    destinationNumber: string;
    spokenCallerScript: string;
    spokenReceiverSummary: string;
  }): Promise<TelephonyAction> {
    return {
      action: "TRANSFER_EXTERNAL",
      destinationNumber: opts.destinationNumber,
      spokenCallerScript: opts.spokenCallerScript,
      spokenReceiverSummary: opts.spokenReceiverSummary,
      continueAiConversation: false,
    };
  }

  async offerCallback(opts: { spokenCallerScript: string }): Promise<TelephonyAction> {
    return {
      action: "OFFER_CALLBACK",
      spokenCallerScript: opts.spokenCallerScript,
      continueAiConversation: true,
    };
  }

  async startOutboundCallback(opts: {
    destinationNumber: string;
    sessionId: string;
    demo: boolean;
  }): Promise<{ ok: boolean; contactId?: string; reason: string }> {
    if (opts.demo) {
      return { ok: true, contactId: `mock-cb-${opts.sessionId.slice(-8)}`, reason: "mock_outbound" };
    }
    return { ok: false, reason: "connect_outbound_not_configured" };
  }

  interruptAndResume(opts: {
    sessionAttributes: Record<string, string>;
    utterance: string;
    nextMissingSlot?: string | null;
    at?: string;
  }): { action: TelephonyAction; bargeIn: BargeInState } {
    const at = opts.at ?? new Date().toISOString();
    const bargeIn = applyBargeIn({
      prior: readBargeInState(opts.sessionAttributes),
      event: {
        interrupted: detectBargeIn(opts.sessionAttributes, opts.utterance),
        utterance: opts.utterance,
        previousPromptSlot: opts.sessionAttributes.promptSlot,
        at,
      },
      nextMissingSlot: opts.nextMissingSlot,
    });
    return {
      bargeIn,
      action: {
        action: "CONTINUE",
        continueAiConversation: true,
      },
    };
  }
}
