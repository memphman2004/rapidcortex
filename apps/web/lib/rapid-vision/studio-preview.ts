import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { STUDIO_ARTIFACT_BUCKET, type StudioReviewRecord } from "./studio-dataset";

const s3 = new S3Client({});

function allowedImageUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "upload.wikimedia.org") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function commonsFileUrl(pageUrl: string | undefined): Promise<string | null> {
  if (!pageUrl) return null;
  let title = "";
  try {
    const url = new URL(pageUrl);
    if (url.hostname !== "commons.wikimedia.org") return null;
    const marker = "/wiki/";
    const index = url.pathname.indexOf(marker);
    if (index < 0) return null;
    title = decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
  if (!title.startsWith("File:")) return null;
  const api = new URL("https://commons.wikimedia.org/w/api.php");
  api.searchParams.set("action", "query");
  api.searchParams.set("titles", title);
  api.searchParams.set("prop", "imageinfo");
  api.searchParams.set("iiprop", "url|mime");
  api.searchParams.set("iiurlwidth", "1600");
  api.searchParams.set("format", "json");
  const response = await fetch(api, { headers: { "user-agent": "NexCortiQModelStudio/1.0 (https://www.nexcortiq.us)" } });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string; mime?: string }[] }> };
  };
  const page = Object.values(body.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (info?.mime && !info.mime.startsWith("image/")) return null;
  return allowedImageUrl(info?.thumburl) ?? allowedImageUrl(info?.url);
}

export async function loadStudioPreview(
  record: StudioReviewRecord,
): Promise<{ kind: "bytes"; bytes: Uint8Array; contentType: string } | { kind: "redirect"; url: string } | { kind: "missing"; reason: string }> {
  if (record.s3Key && record.s3Key.startsWith("studio/") && !record.s3Key.includes("..")) {
    const object = await s3.send(new GetObjectCommand({ Bucket: STUDIO_ARTIFACT_BUCKET, Key: record.s3Key }));
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes) return { kind: "missing", reason: "The stored image could not be read." };
    return { kind: "bytes", bytes, contentType: object.ContentType || "image/png" };
  }
  const direct = allowedImageUrl(record.imageUrl);
  if (direct) return { kind: "redirect", url: direct };
  const commons = await commonsFileUrl(record.sourceUrl);
  if (commons) return { kind: "redirect", url: commons };
  return { kind: "missing", reason: "No preview is stored for this candidate." };
}
