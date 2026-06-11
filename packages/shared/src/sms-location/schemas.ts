import { z } from "zod";

export const locateSubmitBodySchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().min(0).max(100_000).optional(),
  altitude: z.number().optional(),
  locationText: z.string().min(1).max(500).optional(),
  source: z.enum(["GPS", "CELL_TOWER", "MANUAL"]).optional(),
});
