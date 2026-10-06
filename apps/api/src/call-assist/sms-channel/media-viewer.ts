import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isCallAssistConfirmationNumber } from "rapid-cortex-shared";
import { listMediaForConfirmation } from "./media-store.js";

const URL_TTL_SECS = 15 * 60;
const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });

export type SmsMediaViewItem = {
  s3Key: string;
  contentType: string;
  mediaType: "IMAGE" | "VIDEO" | "UNSUPPORTED";
  fileSizeBytes: number;
  receivedAt: string;
  viewUrl: string;
  sceneLabels: string[];
};

export async function getMediaForConfirmation(
  agencyId: string,
  confirmationNumber: string,
): Promise<SmsMediaViewItem[]> {
  if (!agencyId || !isCallAssistConfirmationNumber(confirmationNumber)) return [];
  const records = await listMediaForConfirmation(agencyId, confirmationNumber);
  const items = await Promise.all(
    records
      .filter((r) => r.moderationPassed && r.agencyId === agencyId)
      .map(async (r): Promise<SmsMediaViewItem> => ({
        s3Key: r.s3Key,
        contentType: r.contentType,
        mediaType: r.mediaType,
        fileSizeBytes: r.fileSizeBytes,
        receivedAt: r.receivedAt,
        viewUrl: await getSignedUrl(s3, new GetObjectCommand({ Bucket: r.s3Bucket, Key: r.s3Key }), {
          expiresIn: URL_TTL_SECS,
        }),
        sceneLabels: r.sceneLabels,
      })),
  );
  return items.sort((a, b) => new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime());
}
