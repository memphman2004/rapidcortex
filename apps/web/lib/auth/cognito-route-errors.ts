import { cognitoPasswordPolicyError } from "@/lib/auth/cognito-password-policy";

/** Map AWS Cognito / SDK faults from API routes — never leak internal details to clients */
export type AuthRouteFailure = {
  status: number;
  body: { error: string; code?: string };
};

function errorName(err: unknown): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const n = (err as { name?: unknown }).name;
  return typeof n === "string" ? n : undefined;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? "");
}

const transientNetworkHint =
  /econn(refused|reset)|etimedout|enotfound|socket hang up|connection closed|network|fetch failed|timeout|timed out|getaddrinfo|\bECONN\b/i;

/**
 * Normalize failures from `@aws-sdk/client-cognito-identity-provider` (and Node networking).
 */
export function mapUpstreamAuthFailure(err: unknown): AuthRouteFailure {
  const name = errorName(err);
  const msg = messageOf(err);

  if (
    name === "NetworkingError" ||
    name === "TimeoutError" ||
    transientNetworkHint.test(msg)
  ) {
    return {
      status: 503,
      body: {
        error: "Authentication service is temporarily unavailable.",
        code: "AUTH_UPSTREAM_UNAVAILABLE",
      },
    };
  }
  if (name === "TooManyRequestsException") {
    return {
      status: 429,
      body: {
        error: "Too many sign-in attempts. Try again in a few minutes.",
        code: name,
      },
    };
  }
  if (
    name === "NotAuthorizedException" ||
    name === "UserNotFoundException" ||
    name === "NotAuthorizedServiceException"
  ) {
    return { status: 401, body: { error: "Invalid credentials" } };
  }
  if (name === "PasswordResetRequiredException") {
    return {
      status: 409,
      body: {
        error: "Password must be reset before sign-in.",
        code: name,
      },
    };
  }
  if (name === "UserNotConfirmedException") {
    return {
      status: 409,
      body: {
        error: "Verify your email address before signing in.",
        code: name,
      },
    };
  }
  if (name === "InvalidParameterException") {
    return {
      status: 400,
      body: { error: "Invalid sign-in parameters.", code: name },
    };
  }
  if (
    name === "ResourceNotFoundException" ||
    name === "InvalidUserPoolConfigurationException"
  ) {
    return {
      status: 503,
      body: {
        error: "Authentication is misconfigured.",
        code: "AUTH_CONFIGURATION_ERROR",
      },
    };
  }
  console.warn("[auth] cognito/route error mapped to generic failure", name, msg.slice(0, 200));
  return { status: 401, body: { error: "Invalid credentials" } };
}

/**
 * `RespondToAuthChallenge` failures: `NotAuthorizedException` usually means an expired challenge
 * `Session`, not a wrong email/password on initial sign-in.
 */
export function mapRespondToAuthChallengeFailure(err: unknown): AuthRouteFailure {
  const name = errorName(err);
  const mapped = mapUpstreamAuthFailure(err);
  if (name === "NotAuthorizedException") {
    const msg = messageOf(err);
    const looksExpired =
      /session|expired|invalid.*challenge|flow/i.test(msg) || msg.trim().length === 0;
    if (looksExpired) {
      return {
        status: 401,
        body: {
          error:
            "This sign-in step expired or could not be verified. Enter your email and password again.",
          code: name,
        },
      };
    }
  }
  return mapped;
}
