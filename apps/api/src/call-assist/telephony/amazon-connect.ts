import { ConnectClient, StartOutboundVoiceContactCommand } from "@aws-sdk/client-connect";
import {
  emergencyTransferAction,
  type TelephonyAction,
  type TelephonyEmergencyDestinations,
  type TelephonyProvider,
} from "./provider.js";
import { applyBargeIn, detectBargeIn, readBargeInState, type BargeInState } from "./barge-in.js";

let connect: ConnectClient | null = null;

function connectClient(): ConnectClient {
  if (!connect) connect = new ConnectClient({ region: process.env.AWS_REGION?.trim() || "us-east-1" });
  return connect;
}

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
    const instanceId = process.env.CONNECT_INSTANCE_ID?.trim() ?? "";
    const contactFlowId = process.env.CALL_ASSIST_CONTACT_FLOW_ID?.trim() ?? "";
    const sourcePhoneNumber = process.env.CALL_ASSIST_OUTBOUND_CALLER_ID?.trim() ?? "";
    if (!instanceId || !contactFlowId || !sourcePhoneNumber) {
      return { ok: false, reason: "connect_outbound_not_configured" };
    }
    try {
      const out = await connectClient().send(
        new StartOutboundVoiceContactCommand({
          DestinationPhoneNumber: opts.destinationNumber,
          ContactFlowId: contactFlowId,
          InstanceId: instanceId,
          SourcePhoneNumber: sourcePhoneNumber,
          Attributes: { callAssistSessionId: opts.sessionId, callback: "true" },
        }),
      );
      if (!out.ContactId) return { ok: false, reason: "connect_outbound_no_contact" };
      return { ok: true, contactId: out.ContactId, reason: "connect_outbound" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "connect_outbound_failed";
      return { ok: false, reason: message.slice(0, 180) };
    }
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
