import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import type { UserContext } from "rapid-cortex-shared";
import { isRcsuperadmin } from "rapid-cortex-shared";
import { withCorrelationHeaders } from "../../lib/correlation.js";
import { env } from "../../lib/env.js";
import { forbidden, ok, serviceUnavailable, unauthorized } from "../../lib/response.js";

export function httpMethod(event: APIGatewayProxyEventV2): string {
  return event.requestContext.http?.method?.toUpperCase() ?? "GET";
}

export function parseJsonBody(event: APIGatewayProxyEventV2): unknown | null {
  try {
    return JSON.parse(event.body ?? "{}");
  } catch {
    return null;
  }
}

export function mobileEnvelope<T>(data: T, statusCode = 200): APIGatewayProxyResultV2 {
  return ok({ success: true, data }, statusCode);
}

export function mobileError(
  event: APIGatewayProxyEventV2,
  result: APIGatewayProxyResultV2,
): APIGatewayProxyResultV2 {
  return withCorrelationHeaders(event, result);
}

export function mobileOk<T>(
  event: APIGatewayProxyEventV2,
  data: T,
  statusCode = 200,
): APIGatewayProxyResultV2 {
  return withCorrelationHeaders(event, mobileEnvelope(data, statusCode));
}

export function gateSafeSound(event: APIGatewayProxyEventV2): APIGatewayProxyResultV2 | null {
  if (!env.enableSafeSound) {
    return mobileError(event, serviceUnavailable("Safe & Sound is not enabled for this deployment"));
  }
  return null;
}

export function gateGuardian(event: APIGatewayProxyEventV2): APIGatewayProxyResultV2 | null {
  if (!env.enableGuardian) {
    return mobileError(event, serviceUnavailable("Guardian is not enabled for this deployment"));
  }
  return null;
}

/** Device owner or RC superadmin within tenant. */
export function assertDeviceOwner(user: UserContext, ownerId: string): APIGatewayProxyResultV2 | null {
  if (isRcsuperadmin(user)) return null;
  if (user.userId !== ownerId) return forbidden("You do not have access to this device");
  return null;
}

export function useSafeSoundMock(): boolean {
  return env.safeSoundMock || !env.safeSoundDevicesTable;
}

export function useGuardianMock(): boolean {
  return env.guardianMock || !env.guardianEventsTable;
}

export function agencyPk(agencyId: string): string {
  return `AGENCY#${agencyId}`;
}

export function deviceSk(deviceId: string): string {
  return `SS_DEVICE#${deviceId}`;
}

export function geofenceSk(geofenceId: string): string {
  return `SS_GEOFENCE#${geofenceId}`;
}

export function contactSk(contactId: string): string {
  return `SS_CONTACT#${contactId}`;
}

export function locationSk(deviceId: string, recordedAt: string): string {
  return `SS_LOC#${deviceId}#${recordedAt}`;
}

export function guardianEventSk(eventId: string): string {
  return `GUARDIAN_EVENT#${eventId}`;
}
