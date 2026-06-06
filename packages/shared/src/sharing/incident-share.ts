import { z } from "zod";

export type IncidentShareStatus = "active" | "revoked" | "expired";

export type IncidentShareRecord = {
  shareId: string;
  incidentId: string;
  ownerAgencyId: string;
  recipientAgencyId: string;
  status: IncidentShareStatus;
  createdAt: string;
  createdByUserId: string;
  /** Unix epoch seconds — Dynamo TTL attribute when table TTL is enabled. */
  ttlEpoch?: number;
};

export type AgencySharePartnerStatus = "active" | "revoked";

export type AgencySharePartnerRecord = {
  ownerAgencyId: string;
  partnerAgencyId: string;
  status: AgencySharePartnerStatus;
  createdAt: string;
};

export const postIncidentShareBodySchema = z.object({
  recipientAgencyId: z.string().min(1).max(128),
  ttlHours: z.number().int().min(1).max(168).optional(),
});
export type PostIncidentShareBody = z.infer<typeof postIncidentShareBodySchema>;

export const postAgencySharePartnerBodySchema = z.object({
  partnerAgencyId: z.string().min(1).max(128),
});
export type PostAgencySharePartnerBody = z.infer<typeof postAgencySharePartnerBodySchema>;
