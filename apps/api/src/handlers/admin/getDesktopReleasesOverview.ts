import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { forbidden, ok, serverError, unauthorized } from "../../lib/response.js";
import { DesktopReleaseService } from "../../services/desktopReleaseService.js";

const service = new DesktopReleaseService();

export const handler: APIGatewayProxyHandlerV2 = async (_event) => {
  try {
    const user = await getUserContext(_event);
    if (!user) return unauthorized();
    if (!isUserAccountActive(user)) return unauthorized(ACCOUNT_INACTIVE_MESSAGE);
    service.assertCanDownloadDesktopInstallers(user);
    const body = await service.getOverview();
    return ok(body);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return forbidden();
    }
    return serverError();
  }
};
