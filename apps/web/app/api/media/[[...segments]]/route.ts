import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withFeatureContract } from "@/lib/rapid-cortex/contract-response";
import { proxyToAuthUpstream } from "@/lib/server/auth-upstream-proxy";

type Ctx = { params: Promise<{ segments?: string[] }> };
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED_MEDIA_MIME_PREFIXES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

function resolveFeatureId(segments: string[]): string {
  if (segments.length === 0) return "caller_photo_upload";
  if (segments[0] === "upload-url") return "caller_photo_upload";
  if (segments.length >= 2 && segments[1] === "audit-event") return "media_audit_trail";
  if (segments.length >= 2 && segments[1] === "retention") return "retention_controls";
  return "caller_video_upload";
}

async function handler(request: NextRequest, ctx: Ctx) {
  const { segments = [] } = await ctx.params;
  const candidateId = segments[0];
  if (candidateId && !/^[a-zA-Z0-9_-]+$/.test(candidateId)) {
    return NextResponse.json({ error: "Invalid media identifier" }, { status: 400 });
  }

  if (request.method === "POST") {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File too large (max 500MB)" }, { status: 413 });
    }

    const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    if (!isMultipart && contentType.length > 0) {
      const isAllowed = ALLOWED_MEDIA_MIME_PREFIXES.some((allowed) =>
        contentType.startsWith(allowed),
      );
      if (!isAllowed) {
        return NextResponse.json({ error: "Unsupported media type" }, { status: 415 });
      }
    }
  }

  const endpoint = `/api/media/${segments.join("/")}`.replace(/\/$/, "") || "/api/media";
  return withFeatureContract(resolveFeatureId(segments), async () =>
    proxyToAuthUpstream(request, endpoint),
  );
}

export async function GET(request: NextRequest, ctx: Ctx) {
  return handler(request, ctx);
}

export async function POST(request: NextRequest, ctx: Ctx) {
  return handler(request, ctx);
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  return handler(request, ctx);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  return handler(request, ctx);
}
