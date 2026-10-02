export type TelephonyActionName =
  | "TRANSFER_911"
  | "TRANSFER_QUEUE"
  | "TRANSFER_EXTERNAL"
  | "CONTINUE"
  | "OFFER_CALLBACK"
  | "SMS_TTY";

export type TelephonyAction = {
  action: TelephonyActionName;
  destinationNumber?: string;
  spokenCallerScript?: string;
  spokenReceiverSummary?: string;
  continueAiConversation: boolean;
};

export type TelephonyEmergencyDestinations = {
  liveEmergencyNumber: string;
  demoEmergencyNumber: string;
};

/**
 * 911 destination is tenant telephony config, never a prompt or feature flag.
 * Demo may only swap the destination number — never skip TRANSFER_911.
 */
export function emergencyTransferAction(
  destinations: TelephonyEmergencyDestinations,
  opts: { demo: boolean; spokenCallerScript: string },
): TelephonyAction {
  return {
    action: "TRANSFER_911",
    destinationNumber: opts.demo ? destinations.demoEmergencyNumber : destinations.liveEmergencyNumber,
    spokenCallerScript: opts.spokenCallerScript,
    continueAiConversation: false,
  };
}

export interface TelephonyProvider {
  name: string;
  emergencyTransfer(
    destinations: TelephonyEmergencyDestinations,
    opts: { demo: boolean; spokenCallerScript: string },
  ): Promise<TelephonyAction>;
  warmTransfer(opts: {
    destinationNumber: string;
    spokenCallerScript: string;
    spokenReceiverSummary: string;
  }): Promise<TelephonyAction>;
}
