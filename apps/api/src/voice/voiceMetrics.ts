export function logVoiceMetric(event: Record<string, unknown>): void {
  console.log(JSON.stringify({ type: "voice.metric", ts: new Date().toISOString(), ...event }));
}
