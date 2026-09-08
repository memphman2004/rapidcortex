import {
  emergencyTransferAction,
  type TelephonyAction,
  type TelephonyEmergencyDestinations,
  type TelephonyProvider,
} from "./provider.js";

/**
 * Amazon Connect is the first TelephonyProvider.
 * Contact flows execute the returned action (transfer number / queue).
 * This adapter does not stream audio; KVS barge-in is a later Connect integration.
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
}
