import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  createSubscriptionPayloadSchema,
  profileLanguagePayloadSchema,
} from "rapid-cortex-shared";
import { AUDIT_EVENT_TYPES } from "rapid-cortex-security";
import { ACCOUNT_INACTIVE_MESSAGE, getUserContext, isUserAccountActive } from "../../lib/auth.js";
import {
  badRequest,
  badRequestFromZod,
  notFound,
  serverError,
  unauthorized,
} from "../../lib/response.js";
import { makeId } from "../../lib/ids.js";
import { AuditRepository } from "../../repositories/auditRepository.js";
import {
  gateSafeSound,
  httpMethod,
  mobileError,
  mobileOk,
  parseJsonBody,
} from "./shared.js";

const auditRepo = new AuditRepository();

/** In-memory mock for Guardian subscription + activation (Stripe live path TBD). */
const subscriptionsByOwner = new Map<
  string,
  Array<{
    subscriptionId: string;
    deviceId: string;
    deviceSerial: string;
    status: "active" | "past_due" | "canceled" | "trialing" | "incomplete";
    amountCents: number;
    currency: string;
    interval: "month";
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    stripeCustomerId: string;
    createdAt: string;
    updatedAt: string;
  }>
>();

const activationBySerial = new Map<string, { polls: number; ownerId: string }>();
const preferredLanguageByUser = new Map<string, string>();

function periodEndIso(days = 30): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Safe & Sound subscriptions, profile language, and Guardian activation status.
 * Mock-first until Stripe eSIM provisioning is wired.
 */
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const gate = gateSafeSound(event);
    if (gate) return gate;

    const user = await getUserContext(event);
    if (!user) return mobileError(event, unauthorized());
    if (!isUserAccountActive(user)) return mobileError(event, unauthorized(ACCOUNT_INACTIVE_MESSAGE));

    const method = httpMethod(event);
    const path = event.rawPath ?? "";
    const agencyId = user.agencyId;
    const subscriptionId = event.pathParameters?.subscriptionId?.trim();
    const deviceId = event.pathParameters?.deviceId?.trim();

    if (method === "PATCH" && path === "/api/safe-sound/profile/language") {
      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = profileLanguagePayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));
      preferredLanguageByUser.set(user.userId, parsed.data.languageCode);
      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SAFE_SOUND_PROFILE_LANGUAGE_UPDATED,
        details: { languageCode: parsed.data.languageCode },
        createdAt: new Date().toISOString(),
        resourceType: "user",
        resourceId: user.userId,
      });
      return mobileOk(event, { preferredLanguage: parsed.data.languageCode });
    }

    if (method === "GET" && path === "/api/safe-sound/subscriptions") {
      const list = subscriptionsByOwner.get(user.userId) ?? [];
      return mobileOk(event, { subscriptions: list });
    }

    if (method === "POST" && path === "/api/safe-sound/subscriptions") {
      const body = parseJsonBody(event);
      if (body === null) return mobileError(event, badRequest("Invalid JSON"));
      const parsed = createSubscriptionPayloadSchema.safeParse(body);
      if (!parsed.success) return mobileError(event, badRequestFromZod(parsed.error));

      const now = new Date().toISOString();
      const sub = {
        subscriptionId: makeId("ssub"),
        deviceId: makeId("ssdev"),
        deviceSerial: parsed.data.deviceSerial,
        status: "active" as const,
        amountCents: 399,
        currency: "usd",
        interval: "month" as const,
        currentPeriodEnd: periodEndIso(),
        cancelAtPeriodEnd: false,
        stripeCustomerId: `cus_mock_${user.userId.slice(0, 8)}`,
        createdAt: now,
        updatedAt: now,
      };
      const list = subscriptionsByOwner.get(user.userId) ?? [];
      list.push(sub);
      subscriptionsByOwner.set(user.userId, list);
      activationBySerial.set(parsed.data.deviceSerial, { polls: 0, ownerId: user.userId });

      await auditRepo.create({
        eventId: makeId("audit"),
        agencyId,
        actorId: user.userId,
        type: AUDIT_EVENT_TYPES.SAFE_SOUND_SUBSCRIPTION_CREATED,
        details: { subscriptionId: sub.subscriptionId, deviceSerial: sub.deviceSerial },
        createdAt: now,
        resourceType: "integration",
        resourceId: sub.subscriptionId,
      });

      return mobileOk(
        event,
        {
          subscription: sub,
          // Stripe PaymentSheet client secret placeholder for mock / dry-run
          clientSecret: `pi_mock_${sub.subscriptionId}_secret_mock`,
        },
        201,
      );
    }

    if (
      method === "POST" &&
      subscriptionId &&
      path === `/api/safe-sound/subscriptions/${subscriptionId}/portal`
    ) {
      const list = subscriptionsByOwner.get(user.userId) ?? [];
      const found = list.find((s) => s.subscriptionId === subscriptionId);
      if (!found) return mobileError(event, notFound("Subscription not found"));
      return mobileOk(event, {
        url: `https://billing.stripe.com/p/session/test_mock_${subscriptionId}`,
      });
    }

    if (
      method === "GET" &&
      deviceId &&
      path === `/api/safe-sound/devices/${deviceId}/activation-status`
    ) {
      const state = activationBySerial.get(deviceId) ?? { polls: 0, ownerId: user.userId };
      if (state.ownerId !== user.userId && user.role !== "rcsuperadmin") {
        return mobileError(event, notFound("Device not found"));
      }
      state.polls += 1;
      activationBySerial.set(deviceId, state);

      const status =
        state.polls <= 1
          ? "activating_esim"
          : state.polls <= 3
            ? "connecting_network"
            : state.polls <= 5
              ? "acquiring_location"
              : "ready";

      return mobileOk(event, {
        status,
        message:
          status === "ready"
            ? "Device is ready"
            : status === "activating_esim"
              ? "Activating eSIM..."
              : status === "connecting_network"
                ? "Connecting to network..."
                : "Getting first location...",
      });
    }

    return mobileError(event, notFound());
  } catch (e) {
    console.error("safe-sound subscriptionsHttp", e);
    return mobileError(event, serverError());
  }
};
