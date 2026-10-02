/**
 * Unit tests for venue evidence service — SHA-256 hash verification
 * and chain-of-custody (RFP 2396IP, Build Item 1).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const { mockSend, mockAuditCreate } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockAuditCreate: vi.fn(),
}));

vi.mock("@aws-sdk/client-dynamodb", () => ({ DynamoDBClient: class DynamoDBClient {} }));
vi.mock("@aws-sdk/lib-dynamodb", () => ({
  DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  GetCommand: class GetCommand {
    type = "GetCommand";
    constructor(public readonly input: unknown) {}
  },
  PutCommand: class PutCommand {
    type = "PutCommand";
    constructor(public readonly input: unknown) {}
  },
  QueryCommand: class QueryCommand {
    type = "QueryCommand";
    constructor(public readonly input: unknown) {}
  },
}));

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class S3Client {},
  PutObjectCommand: class PutObjectCommand {
    constructor(public readonly input: unknown) {}
  },
  GetObjectCommand: class GetObjectCommand {
    constructor(public readonly input: unknown) {}
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://mock.s3.presigned/test"),
}));

vi.mock("../../repositories/auditRepository.js", () => ({
  AuditRepository: class {
    create = mockAuditCreate;
  },
}));

process.env.VENUE_CONFIG_TABLE = "test-venue-config";
process.env.VENUE_EVIDENCE_BUCKET = "test-evidence-bucket";
process.env.VENUE_EVIDENCE_MOCK = "1"; // skip real S3

import {
  requestEvidenceUpload,
  listEvidenceForIncident,
  listCustodyChain,
} from "./venue-evidence-service.js";

function sha256hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

const INCIDENT_STUB = {
  pk: "VENUE#MBS",
  sk: "INCIDENT#inc_001",
  incidentId: "inc_001",
  venueCode: "MBS",
  agencyId: "agency_abc",
  status: "open",
  createdAt: new Date().toISOString(),
};

const UPLOAD_BODY = {
  fileName: "photo1.jpg",
  contentType: "image/jpeg",
  byteSize: 102400,
  sha256: sha256hex("mock-photo-content"),
  kind: "photo" as const,
  label: "Scene photo",
};

const BASE = {
  agencyId: "agency_abc",
  venueCode: "MBS",
  incidentId: "inc_001",
  actorId: "user_001",
  actorLabel: "Officer Smith",
};

describe("requestEvidenceUpload", () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockAuditCreate.mockReset().mockResolvedValue(undefined);
  });

  it("returns evidenceId, mockUploadUrl, and s3Key in mock mode", async () => {
    mockSend.mockImplementation((cmd: { type?: string }) => {
      if (cmd.type === "GetCommand") return Promise.resolve({ Item: INCIDENT_STUB });
      return Promise.resolve({});
    });

    const result = await requestEvidenceUpload({ ...BASE, body: UPLOAD_BODY });

    expect(result.evidenceId).toMatch(/^evid_/);
    expect(result.s3Key).toContain("MBS/inc_001");
    expect(result.s3Key).toContain("photo1.jpg");
    expect(result.uploadUrl).toContain("mock-evidence-bucket.local");
    expect(result.expiresIn).toBe(300);
  });

  it("throws 404 when incident does not exist", async () => {
    mockSend.mockResolvedValue({ Item: undefined });
    await expect(
      requestEvidenceUpload({ ...BASE, body: UPLOAD_BODY }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("stores pending evidence record with sha256 in lowercase", async () => {
    mockSend.mockImplementation((cmd: { type?: string }) => {
      if (cmd.type === "GetCommand") return Promise.resolve({ Item: INCIDENT_STUB });
      return Promise.resolve({});
    });

    const upperSha = UPLOAD_BODY.sha256.toUpperCase();
    await requestEvidenceUpload({ ...BASE, body: { ...UPLOAD_BODY, sha256: upperSha } });

    const putCall = mockSend.mock.calls.find(
      (c: unknown[]) => (c[0] as { type?: string })?.type === "PutCommand",
    );
    expect(putCall).toBeTruthy();
    const item = (putCall?.[0] as { input?: { Item?: Record<string, unknown> } })?.input?.Item;
    expect(item?.status).toBe("pending_upload");
    expect(item?.sha256).toBe(upperSha.toLowerCase());
    expect(item?.agencyId).toBe("agency_abc");
  });
});

describe("listEvidenceForIncident", () => {
  it("returns items filtered by agencyId", async () => {
    const evidenceRow = {
      pk: "VENUE#MBS",
      sk: "INCIDENT#inc_001#EVIDENCE#evid_001",
      evidenceId: "evid_001",
      incidentId: "inc_001",
      agencyId: "agency_abc",
      fileName: "photo1.jpg",
      status: "confirmed",
    };
    const otherRow = { ...evidenceRow, agencyId: "other_agency", evidenceId: "evid_999" };

    mockSend.mockResolvedValue({ Items: [evidenceRow, otherRow] });

    const result = await listEvidenceForIncident("MBS", "inc_001", "agency_abc");
    expect(result).toHaveLength(1);
    expect(result[0]?.evidenceId).toBe("evid_001");
  });
});

describe("listCustodyChain", () => {
  it("returns only records matching incidentId and agencyId", async () => {
    const cocRow = {
      pk: "VENUE#MBS",
      sk: "COC#evid_001#2026-01-01T00:00:00.000Z#coc_001",
      custodyId: "coc_001",
      evidenceId: "evid_001",
      incidentId: "inc_001",
      agencyId: "agency_abc",
    };
    const wrongRow = { ...cocRow, incidentId: "inc_other", custodyId: "coc_002" };

    mockSend.mockResolvedValue({ Items: [cocRow, wrongRow] });

    const result = await listCustodyChain("MBS", "inc_001", "evid_001", "agency_abc");
    expect(result).toHaveLength(1);
    expect(result[0]?.custodyId).toBe("coc_001");
  });
});

describe("SHA-256 schema validation", () => {
  it("accepts valid 64-char hex sha256", async () => {
    const { venueEvidenceUploadBodySchema } = await import("rapid-cortex-shared");
    const result = venueEvidenceUploadBodySchema.safeParse({
      fileName: "test.jpg",
      contentType: "image/jpeg",
      byteSize: 1024,
      sha256: sha256hex("some content"),
      kind: "photo",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-hex sha256", async () => {
    const { venueEvidenceUploadBodySchema } = await import("rapid-cortex-shared");
    const result = venueEvidenceUploadBodySchema.safeParse({
      fileName: "test.jpg",
      contentType: "image/jpeg",
      byteSize: 1024,
      sha256: "not-a-valid-sha256-hash-string!!!",
      kind: "photo",
    });
    expect(result.success).toBe(false);
  });

  it("rejects sha256 of wrong length", async () => {
    const { venueEvidenceUploadBodySchema } = await import("rapid-cortex-shared");
    const result = venueEvidenceUploadBodySchema.safeParse({
      fileName: "test.jpg",
      contentType: "image/jpeg",
      byteSize: 1024,
      sha256: "abc123",
      kind: "photo",
    });
    expect(result.success).toBe(false);
  });
});
