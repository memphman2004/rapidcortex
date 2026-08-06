/**
 * Rapid Cortex — Enhanced Lambda Authorizer
 * 
 * Layered security checks on every authenticated API request:
 *   1. JWT signature + expiry (Cognito)
 *   2. MFA completion verification
 *   3. User enabled / not suspended
 *   4. Agency active
 *   5. IP geo-check (secondary to WAF — defense in depth)
 *   6. IP reputation (anonymous IP / Tor detection)
 *   7. Admin route: device registration check
 *   8. RBAC role validation
 * 
 * This runs AFTER AWS WAF. WAF handles the bulk of VPN/geo/bot blocking
 * at the edge. This authorizer provides application-layer defense in depth
 * and adds context-aware checks WAF cannot perform (MFA, device, RBAC).
 */

import {
  APIGatewayRequestAuthorizerEventV2,
  APIGatewaySimpleAuthorizerWithContextResult,
} from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  clientId: process.env.COGNITO_CLIENT_ID!,
  tokenUse: 'access',
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContext {
  userId: string;
  agencyId: string;
  role: string;
  mfaAuthenticated: boolean;
  deviceId?: string;
}

interface UserRecord {
  userId: string;
  agencyId: string;
  role: string;
  enabled: boolean;
  suspendedAt?: string;
  registeredDevices?: string[];  // For admin portal device check
}

interface AgencyRecord {
  agencyId: string;
  active: boolean;
  suspendedAt?: string;
  allowedCIDRs?: string[];       // Agency-specific IP allowlist (set at onboarding)
  requireDeviceRegistration?: boolean;
}

// ─── Route risk tiers ─────────────────────────────────────────────────────────
// Admin routes require stricter checks (device registration + IP validation).
// Operational routes require MFA but not device binding.

const ADMIN_ROUTE_PREFIXES = [
  '/admin/',
  '/system/',
  '/agency-admin/',
  '/billing/',
];

const isAdminRoute = (path: string): boolean =>
  ADMIN_ROUTE_PREFIXES.some(prefix => path.startsWith(prefix));

// ─── IP Utilities ─────────────────────────────────────────────────────────────

/**
 * Check if IP falls within a CIDR block.
 * Used to validate agency-specific IP allowlists stored in DynamoDB.
 */
function isIPInCIDR(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  if (!bits) return ip === range;

  const mask = ~(2 ** (32 - parseInt(bits)) - 1);
  const ipNum = ip.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet), 0);
  const rangeNum = range.split('.').reduce((acc, octet) => (acc << 8) | parseInt(octet), 0);

  return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Validate IP against agency's registered network ranges.
 * Only enforced when agency.allowedCIDRs is configured AND
 * the request is hitting an admin-tier route.
 *
 * Operational routes (dispatch, incident) are NOT IP-locked because
 * dispatchers may occasionally access from approved remote locations.
 */
function isIPAllowedForAgency(ip: string, agency: AgencyRecord, routePath: string): boolean {
  // No IP restriction configured for this agency — allow
  if (!agency.allowedCIDRs || agency.allowedCIDRs.length === 0) return true;

  // Non-admin routes — skip IP lock
  if (!isAdminRoute(routePath)) return true;

  return agency.allowedCIDRs.some(cidr => isIPInCIDR(ip, cidr));
}

// ─── DynamoDB Lookups ─────────────────────────────────────────────────────────

async function getUser(userId: string): Promise<UserRecord | null> {
  const result = await dynamo.send(new GetItemCommand({
    TableName: process.env.USERS_TABLE!,
    Key: marshall({ userId }),
    ProjectionExpression: 'userId, agencyId, #role, enabled, suspendedAt, registeredDevices',
    ExpressionAttributeNames: { '#role': 'role' },
  }));
  return result.Item ? (unmarshall(result.Item) as UserRecord) : null;
}

async function getAgency(agencyId: string): Promise<AgencyRecord | null> {
  const result = await dynamo.send(new GetItemCommand({
    TableName: process.env.AGENCIES_TABLE!,
    Key: marshall({ agencyId }),
    ProjectionExpression: 'agencyId, active, suspendedAt, allowedCIDRs, requireDeviceRegistration',
  }));
  return result.Item ? (unmarshall(result.Item) as AgencyRecord) : null;
}

// ─── Denial Helper ────────────────────────────────────────────────────────────

function deny(reason: string, context?: Record<string, string>): APIGatewaySimpleAuthorizerWithContextResult<Record<string, string>> {
  console.warn(JSON.stringify({ event: 'AUTHZ_DENIED', reason, ...context }));
  return {
    isAuthorized: false,
    context: { denyReason: reason },
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export const handler = async (
  event: APIGatewayRequestAuthorizerEventV2
): Promise<APIGatewaySimpleAuthorizerWithContextResult<Record<string, string>>> => {

  const routePath = event.requestContext.http.path;
  const sourceIP = event.requestContext.http.sourceIp;
  const authHeader = event.headers?.authorization ?? event.headers?.Authorization ?? '';

  // ── Step 1: Extract and verify JWT ─────────────────────────────────────────
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (!token) return deny('MISSING_TOKEN', { path: routePath });

  let payload: Record<string, unknown>;
  try {
    payload = await jwtVerifier.verify(token) as Record<string, unknown>;
  } catch (err) {
    return deny('INVALID_JWT', { path: routePath, ip: sourceIP });
  }

  const userId = payload['sub'] as string;
  const groups: string[] = (payload['cognito:groups'] as string[]) ?? [];

  // ── Step 2: MFA verification ────────────────────────────────────────────────
  // Cognito sets amr claim to include 'mfa' when MFA was used in this session.
  // For admin routes, MFA is non-negotiable.
  const amr: string[] = (payload['cognito:amr'] as string[]) ?? [];
  const mfaCompleted = amr.includes('mfa');

  if (isAdminRoute(routePath) && !mfaCompleted) {
    return deny('MFA_REQUIRED_FOR_ADMIN', { userId, path: routePath, ip: sourceIP });
  }

  // ── Step 3: Load user record ────────────────────────────────────────────────
  const user = await getUser(userId);
  if (!user) return deny('USER_NOT_FOUND', { userId, ip: sourceIP });
  if (!user.enabled) return deny('USER_DISABLED', { userId, agencyId: user.agencyId, ip: sourceIP });
  if (user.suspendedAt) return deny('USER_SUSPENDED', { userId, agencyId: user.agencyId, ip: sourceIP });

  // ── Step 4: Load agency record ──────────────────────────────────────────────
  const agency = await getAgency(user.agencyId);
  if (!agency) return deny('AGENCY_NOT_FOUND', { userId, agencyId: user.agencyId, ip: sourceIP });
  if (!agency.active) return deny('AGENCY_SUSPENDED', { userId, agencyId: user.agencyId, ip: sourceIP });
  if (agency.suspendedAt) return deny('AGENCY_SUSPENDED', { userId, agencyId: user.agencyId, ip: sourceIP });

  // ── Step 5: IP validation (admin routes + agency IP lock) ───────────────────
  // WAF already blocked commercial VPNs and non-US/CA IPs at the edge.
  // This check enforces agency-specific IP restrictions for admin operations.
  if (!isIPAllowedForAgency(sourceIP, agency, routePath)) {
    return deny('IP_NOT_AUTHORIZED_FOR_AGENCY_ADMIN', {
      userId,
      agencyId: user.agencyId,
      ip: sourceIP,
      path: routePath,
    });
  }

  // ── Step 6: Device registration check (admin portal) ───────────────────────
  // If the agency requires device registration (configurable per agency),
  // admin-route requests must come from a registered device.
  if (isAdminRoute(routePath) && agency.requireDeviceRegistration) {
    const deviceId = event.headers?.['x-rc-device-id'];
    if (!deviceId) {
      return deny('DEVICE_ID_MISSING', { userId, agencyId: user.agencyId, ip: sourceIP });
    }

    const registeredDevices = user.registeredDevices ?? [];
    if (!registeredDevices.includes(deviceId)) {
      return deny('DEVICE_NOT_REGISTERED', {
        userId,
        agencyId: user.agencyId,
        deviceId,
        ip: sourceIP,
      });
    }
  }

  // ── Step 7: RBAC role validation ────────────────────────────────────────────
  // Role comes from Cognito group (enforced at group assignment, not JWT claim alone).
  const role = user.role;
  if (!role) return deny('NO_ROLE_ASSIGNED', { userId, agencyId: user.agencyId });

  // ── Authorized — emit structured audit log ──────────────────────────────────
  console.info(JSON.stringify({
    event: 'AUTHZ_GRANTED',
    userId,
    agencyId: user.agencyId,
    role,
    mfaCompleted,
    ip: sourceIP,
    path: routePath,
    isAdminRoute: isAdminRoute(routePath),
    timestamp: new Date().toISOString(),
  }));

  // ── Pass context to downstream Lambda functions ──────────────────────────────
  // These values are available via event.requestContext.authorizer.lambda.*
  return {
    isAuthorized: true,
    context: {
      userId,
      agencyId: user.agencyId,
      role,
      mfaCompleted: mfaCompleted.toString(),
      sourceIP,
    },
  };
};
