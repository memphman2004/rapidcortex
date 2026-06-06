import { z } from "zod";

/** Standard JSON error body from Lambda/BFF `response` helpers. */
export const apiErrorBodySchema = z.object({
  error: z.string().min(1),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;

/** Generic list envelope used by several list endpoints. */
export function listResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().optional(),
  });
}
