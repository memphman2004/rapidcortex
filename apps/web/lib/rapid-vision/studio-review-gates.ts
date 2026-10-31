import type { ReviewAuditEntry, StudioBox, StudioReviewRecord } from "./studio-dataset";

export type RightsInput = {
  sourceUrl?: string;
  author?: string;
  license?: string;
  commercialUse?: "unverified" | "permitted" | "not_permitted";
  privacy?: string;
};

export function appendAudit(record: StudioReviewRecord, entry: ReviewAuditEntry): StudioReviewRecord {
  return { ...record, audit: [...(record.audit ?? []), entry].slice(-40) };
}

function audit(record: StudioReviewRecord, entry: ReviewAuditEntry): StudioReviewRecord {
  return appendAudit(record, entry);
}

export function validStudioBox(box: StudioBox | null | undefined): box is StudioBox {
  if (!box) return false;
  const values = [box.x, box.y, box.width, box.height];
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) return false;
  if (box.width <= 0 || box.height <= 0) return false;
  if (values.some((value) => value < 0 || value > 1)) return false;
  return box.x + box.width <= 1.001 && box.y + box.height <= 1.001;
}

export function verifyMediaRights(
  record: StudioReviewRecord,
  input: RightsInput,
  reviewer: string,
  now: string,
): { ok: true; record: StudioReviewRecord } | { ok: false; reason: string } {
  const who = reviewer.trim();
  if (!who) return { ok: false, reason: "A reviewer is required before rights can be recorded." };

  if (record.synthetic) {
    const next = audit(
      {
        ...record,
        rightsStatus: "synthetic_internal",
        rightsReviewer: who,
        rightsVerifiedAt: now,
        privacy: input.privacy?.trim() || "Synthetic image. No agency footage and no person.",
        commercialUse: "permitted",
        sourceType: "synthetic",
        trainingLabel: false,
      },
      { at: now, reviewer: who, action: "verify-rights", note: "Marked synthetic. This is not a verified training label." },
    );
    return { ok: true, record: next };
  }

  const sourceUrl = input.sourceUrl?.trim() || record.sourceUrl?.trim() || "";
  const author = input.author?.trim() || "";
  const license = input.license?.trim() || record.license?.trim() || "";
  const privacy = input.privacy?.trim() || "";
  if (!sourceUrl || !author || !license || !privacy) {
    return { ok: false, reason: "Source URL, author, license, and privacy note are required. The Commons photograph stays blocked." };
  }
  if (input.commercialUse !== "permitted" && input.commercialUse !== "not_permitted") {
    return { ok: false, reason: "Record whether commercial model training is permitted. Missing permission is not approval." };
  }
  if (input.commercialUse === "not_permitted") {
    return {
      ok: true,
      record: audit(
        {
          ...record,
          sourceUrl,
          author,
          license,
          privacy,
          commercialUse: "not_permitted",
          rightsStatus: "RESTRICTED",
          rightsReviewer: who,
          rightsVerifiedAt: now,
          approved: false,
          trainingLabel: false,
          status: "REJECTED",
          sourceType: "public",
        },
        { at: now, reviewer: who, action: "verify-rights", note: "Commercial training use is not permitted." },
      ),
    };
  }
  return {
    ok: true,
    record: audit(
      {
        ...record,
        sourceUrl,
        author,
        license,
        privacy,
        commercialUse: "permitted",
        rightsStatus: "LICENSE_VERIFIED",
        rightsReviewer: who,
        rightsVerifiedAt: now,
        approved: false,
        trainingLabel: false,
        status: record.status === "REJECTED" ? "REVIEW_REQUIRED" : record.status,
        sourceType: "public",
      },
      { at: now, reviewer: who, action: "verify-rights", note: "Rights recorded. The training label is still unverified." },
    ),
  };
}

export function verifyTrainingLabel(
  record: StudioReviewRecord,
  reviewer: string,
  now: string,
  note?: string,
  options?: { identifiable?: boolean },
): { ok: true; record: StudioReviewRecord } | { ok: false; reason: string } {
  const who = reviewer.trim();
  if (!who) return { ok: false, reason: "A reviewer is required before a label can be verified." };
  if (options?.identifiable === false) {
    return { ok: false, reason: "The object cannot be identified. The label was not verified. Reject the candidate or request another review." };
  }
  if (!record.approved || record.status !== "APPROVED") {
    return { ok: false, reason: "Accept the candidate before verifying its label." };
  }
  if (!record.rightsVerifiedAt || record.rightsStatus === "REVIEW_REQUIRED" || record.rightsStatus === "UNKNOWN" || record.rightsStatus === "RESTRICTED") {
    return { ok: false, reason: "Rights are still open. The label was not verified." };
  }
  if (!record.category.trim()) return { ok: false, reason: "A category is required before the label can be verified." };
  if (!validStudioBox(record.box)) {
    return { ok: false, reason: "Draw a box around the object before verifying the label." };
  }
  return {
    ok: true,
    record: audit(
      {
        ...record,
        trainingLabel: true,
        labelReviewer: who,
        labelVerifiedAt: now,
        reviewerNote: note?.trim() || record.reviewerNote,
      },
      { at: now, reviewer: who, action: "verify-label", note: note?.trim() || record.category },
    ),
  };
}

export function clearStudioBox(
  record: StudioReviewRecord,
  reviewer: string,
  now: string,
): { ok: true; record: StudioReviewRecord } {
  const who = reviewer.trim() || "reviewer";
  const next: StudioReviewRecord = { ...record, box: null, trainingLabel: false };
  delete next.labelVerifiedAt;
  delete next.labelReviewer;
  return {
    ok: true,
    record: audit(next, { at: now, reviewer: who, action: "clear-box", note: "The box was removed. The label is unverified." }),
  };
}

export function parseStudioBox(value: unknown): StudioBox | null {
  if (!value || typeof value !== "object") return null;
  const box = value as Record<string, unknown>;
  const parsed = { x: Number(box.x), y: Number(box.y), width: Number(box.width), height: Number(box.height) };
  return validStudioBox(parsed) ? parsed : null;
}

export function adjustStudioBox(
  record: StudioReviewRecord,
  box: StudioBox,
  reviewer: string,
  now: string,
): { ok: true; record: StudioReviewRecord } | { ok: false; reason: string } {
  if (!validStudioBox(box)) return { ok: false, reason: "The box must sit inside the image. Coordinates are 0 to 1." };
  const who = reviewer.trim() || "reviewer";
  return {
    ok: true,
    record: audit(
      { ...record, box, trainingLabel: false, labelVerifiedAt: undefined, labelReviewer: undefined },
      { at: now, reviewer: who, action: "correct-box" },
    ),
  };
}

export function addReviewComment(
  record: StudioReviewRecord,
  note: string,
  reviewer: string,
  now: string,
): { ok: true; record: StudioReviewRecord } | { ok: false; reason: string } {
  const text = note.trim();
  if (!text) return { ok: false, reason: "A comment is required." };
  const who = reviewer.trim() || "reviewer";
  return {
    ok: true,
    record: audit({ ...record, reviewerNote: text }, { at: now, reviewer: who, action: "comment", note: text }),
  };
}
