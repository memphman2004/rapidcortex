import {
  ConnectClient,
  StartOutboundVoiceContactCommand,
  TransferContactCommand,
} from "@aws-sdk/client-connect";
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

function connectConfigured(): boolean {
  return Boolean(process.env.CONNECT_INSTANCE_ID?.trim());
}

/** Extract Connect queue ID from a full queue ARN (or return raw if already an ID). */
export function connectQueueIdFromArn(queueArnOrId: string): string {
  const raw = queueArnOrId.trim();
  if (!raw) return "";
  const m = raw.match(/\/queue\/([^/]+)$/i);
  return m?.[1] ?? raw;
}

export type ConnectTransferResult = {
  ok: boolean;
  reason: string;
  contactId?: string;
};

/**
 * Amazon Connect is the live TelephonyProvider for Call Assist.
 *
 * Lex↔Connect barge-in: Lex prompts use allowInterrupt=true; Connect delivers the
 * new utterance with existing slots (see barge-in.ts).
 *
 * Emergency / warm transfer:
 * - Lex-owned live calls: Contact Flow transfers via emergency queue attributes.
 * - Console force-transfer: TransferContact when connectContactId + queue/flow are set.
 * - Without a live ContactId, methods return advisory TelephonyAction only (ledger still records).
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

  /** Offer callback wording for the current caller (spoken prompt only; dial is startOutboundCallback). */
  async offerCallback(opts: { spokenCallerScript: string }): Promise<{ spokenCallerScript: string }> {
    return { spokenCallerScript: opts.spokenCallerScript };
  }

  /**
   * Live queue transfer for an active Connect contact (console force-transfer / emergency).
   * Requires CONNECT_INSTANCE_ID, CALL_ASSIST_CONTACT_FLOW_ID, and a queue ARN/ID.
   */
  async transferActiveContact(opts: {
    contactId: string;
    queueArnOrId: string;
    demo?: boolean;
  }): Promise<ConnectTransferResult> {
    if (opts.demo) {
      return { ok: true, contactId: opts.contactId, reason: "mock_transfer" };
    }
    const instanceId = process.env.CONNECT_INSTANCE_ID?.trim() ?? "";
    const contactFlowId = process.env.CALL_ASSIST_CONTACT_FLOW_ID?.trim() ?? "";
    const queueId = connectQueueIdFromArn(opts.queueArnOrId);
    if (!instanceId || !contactFlowId || !queueId || !opts.contactId.trim()) {
      return { ok: false, reason: "connect_transfer_not_configured" };
    }
    if (!connectConfigured()) {
      return { ok: false, reason: "connect_instance_missing" };
    }
    try {
      const out = await connectClient().send(
        new TransferContactCommand({
          InstanceId: instanceId,
          ContactId: opts.contactId.trim(),
          QueueId: queueId,
          ContactFlowId: contactFlowId,
        }),
      );
      return {
        ok: true,
        contactId: out.ContactId ?? opts.contactId,
        reason: "connect_transfer",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "connect_transfer_failed";
      return { ok: false, reason: message.slice(0, 180) };
    }
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
