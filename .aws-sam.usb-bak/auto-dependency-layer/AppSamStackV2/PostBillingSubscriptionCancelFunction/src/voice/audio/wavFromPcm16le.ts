/** Build a minimal mono 16-bit PCM WAV for providers that expect RIFF/WAV framing. */
export function pcm16leMonoToWav(pcm: Uint8Array, sampleRate = 16000): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let o = 0;
  const writeStr = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o++, s.charCodeAt(i));
  };
  writeStr("RIFF");
  view.setUint32(o, 36 + dataSize, true);
  o += 4;
  writeStr("WAVEfmt ");
  view.setUint32(o, 16, true);
  o += 4;
  view.setUint16(o, 1, true);
  o += 2;
  view.setUint16(o, numChannels, true);
  o += 2;
  view.setUint32(o, sampleRate, true);
  o += 4;
  view.setUint32(o, byteRate, true);
  o += 4;
  view.setUint16(o, blockAlign, true);
  o += 2;
  view.setUint16(o, bitsPerSample, true);
  o += 2;
  writeStr("data");
  view.setUint32(o, dataSize, true);
  o += 4;
  new Uint8Array(buffer, 44).set(pcm);
  return new Uint8Array(buffer);
}

export function readWavSampleRateHeader(wav: Uint8Array): number | null {
  if (wav.byteLength < 44) return null;
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const riff = String.fromCharCode(wav[0]!, wav[1]!, wav[2]!, wav[3]!);
  if (riff !== "RIFF") return null;
  return view.getUint32(24, true);
}
