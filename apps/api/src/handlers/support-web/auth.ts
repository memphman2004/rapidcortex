import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { isRcInternalOperator, type UserContext } from "rapid-cortex-shared";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import { env } from "../../lib/env.js";
import { operationalPasswordBlock } from "../../lib/operationalPasswordGate.js";
import { forbidden, ok, unauthorized } from "../../lib/response.js";

export type SupportAuthOk = { user: UserContext };
export type SupportAuthErr = { error: APIGatewayProxyResultV2 };

export async function requireSupportUser(
  event: APIGatewayProxyEventV2,
): Promise<SupportAuthOk | SupportAuthErr> {
  const user = await getUserContext(event);
  if (!user) return { error: unauthorized() };
  if (!isUserAccountActive(user)) return { error: unauthorized(ACCOUNT_INACTIVE_MESSAGE) };
  const pwd = operationalPasswordBlock(user);
  if (pwd) return { error: pwd };
  if (!env.enableSupportForm) return { error: ok({ error: "Support form is disabled" }, 503) };
  return { user };
}

export async function requireRcTicketOperator(
  event: APIGatewayProxyEventV2,
): Promise<SupportAuthOk | SupportAuthErr> {
  const auth = await requireSupportUser(event);
  if ("error" in auth) return auth;
  if (!isRcInternalOperator(auth.user.role)) return { error: forbidden() };
  return auth;
}

export function actorName(user: UserContext): string {
  return user.displayName?.trim() || user.email || user.userId;
}

export function parseJsonBody(event: APIGatewayProxyEventV2): unknown {
  const raw =
    event.isBase64Encoded && event.body
      ? Buffer.from(event.body, "base64").toString("utf8")
      : (event.body ?? "{}");
  return JSON.parse(raw);
}
