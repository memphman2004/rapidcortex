import { z } from "zod";

/** AVL unit position — agency-scoped, consumed by dispatcher/supervisor map overlays only. */
export const cadAvlUnitPositionSchema = z.object({
  agencyId: z.string().min(1),
  unitId: z.string().min(1).max(64),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.string().datetime(),
  status: z.string().max(40).optional(),
  headingDegrees: z.number().min(0).max(360).optional(),
  speedMph: z.number().min(0).optional(),
  callSign: z.string().max(40).optional(),
});

export type CadAvlUnitPosition = z.infer<typeof cadAvlUnitPositionSchema>;

export const cadAvlListQuerySchema = z.object({
  /** Exclude positions older than this many seconds (default 120). */
  staleAfterSeconds: z.coerce.number().int().min(15).max(3600).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type CadAvlListQuery = z.infer<typeof cadAvlListQuerySchema>;
