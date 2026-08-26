const CHANNEL_NAME = "rc-venue-operational-awareness";

export type OaSyncMessage = {
  venueId: string;
  incidentId: string | null;
  zoneId: string | null;
  levelId: string | null;
};

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

export function publishOperationalSelection(message: OaSyncMessage): void {
  getChannel()?.postMessage(message);
}

export function subscribeOperationalSelection(
  venueId: string,
  onMessage: (message: OaSyncMessage) => void,
): () => void {
  const instance = getChannel();
  if (!instance) return () => undefined;
  const handler = (event: MessageEvent<OaSyncMessage>) => {
    const data = event.data;
    if (!data || data.venueId !== venueId) return;
    onMessage(data);
  };
  instance.addEventListener("message", handler);
  return () => instance.removeEventListener("message", handler);
}
