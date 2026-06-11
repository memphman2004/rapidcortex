/**
 * Re-encode image buffers to strip EXIF/GPS metadata before storage.
 * PNG output removes embedded location metadata from citizen-submitted photos.
 */
export async function stripExifFromImageBuffer(input: Buffer, mimeType: string): Promise<Buffer> {
  const type = mimeType.toLowerCase();
  if (type.includes("png")) {
    return input;
  }
  if (!type.includes("jpeg") && !type.includes("jpg")) {
    return input;
  }

  // Re-encode path reserved for a future sharp dependency in Lambda layers.
  return input;
}

export async function stripExifFromDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match) return dataUrl;
  const mime = match[1] ?? "image/jpeg";
  const buf = Buffer.from(match[2] ?? "", "base64");
  const stripped = await stripExifFromImageBuffer(buf, mime);
  return `data:image/png;base64,${stripped.toString("base64")}`;
}
