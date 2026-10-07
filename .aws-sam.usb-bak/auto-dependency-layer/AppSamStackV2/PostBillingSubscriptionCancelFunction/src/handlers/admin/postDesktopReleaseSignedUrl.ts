import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { z } from "zod";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  unauthorized,
  badRequestFromZod,
} from "../../lib/response.js";
import { DesktopReleaseService } from "../../services/desktopReleaseService.js";

const bodySchema = z.object({
  platform: z.enum(["macos", "windows"]),
});

const service = new DesktopReleaseService();

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const user = await getUserContext(event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    let raw: unknown = {};
    try {
      raw = event.body?.trim() ? JSON.parse(event.body) : {};
    } catch {
      return badRequest("Invalid JSON body");
    }
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) return badRequestFromZod(parsed.error);
    const body = await service.issueSignedUrl(user, parsed.data.platform);
    return ok(body);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    const code = (error as Error & { code?: string }).code;
    if (code === "INSTALLER_NOT_PUBLISHED") return notFound("Installer not published");
    if (code === "INSTALLER_NOT_FOUND") return notFound("Installer not found in storage");
    return serverError();
  }
};
