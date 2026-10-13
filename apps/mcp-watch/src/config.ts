import { z } from "zod";

const configSchema = z.object({
  deploymentStage: z.string().default("dev"),
  publicBaseUrl: z.string().url(),
  watchIngestBaseUrl: z.string().url(),
  watchIngestApiKeySecretArn: z.string().min(1),
  mcpJwtSigningSecretArn: z.string().min(1),
  oauthStateTableName: z.string().min(1),
  cognitoUserPoolId: z.string().min(1),
  cognitoDomain: z.string().min(1),
  cognitoClientId: z.string().min(1),
  cognitoRegion: z.string().default("us-east-1"),
  mcpAudience: z.string().default("nexcort-mcp-watch"),
  mcpIssuer: z.string().url().optional(),
  allowedHosts: z.string().default("mcp.nexcortiq.us"),
  rateLimitPerHour: z.coerce.number().int().positive().default(120),
  upstreamMaxAttempts: z.coerce.number().int().min(1).max(5).default(3),
});

export type McpWatchConfig = z.infer<typeof configSchema> & {
  mcpIssuer: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): McpWatchConfig {
  const publicBaseUrl = (env.MCP_PUBLIC_BASE_URL ?? "https://mcp.nexcortiq.us").replace(/\/$/, "");
  const parsed = configSchema.parse({
    deploymentStage: env.DEPLOYMENT_STAGE ?? "dev",
    publicBaseUrl,
    watchIngestBaseUrl: (env.WATCH_INGEST_BASE_URL ?? "").replace(/\/$/, ""),
    watchIngestApiKeySecretArn: env.RAPID_IQ_WATCH_INGEST_API_KEY_SECRET_ARN ?? "",
    mcpJwtSigningSecretArn: env.MCP_JWT_SIGNING_SECRET_ARN ?? "",
    oauthStateTableName: env.MCP_OAUTH_STATE_TABLE ?? "",
    cognitoUserPoolId: env.COGNITO_USER_POOL_ID ?? "",
    cognitoDomain: (env.COGNITO_DOMAIN ?? "").replace(/\/$/, ""),
    cognitoClientId: env.COGNITO_CLIENT_ID ?? "",
    cognitoRegion: env.AWS_REGION ?? env.COGNITO_REGION ?? "us-east-1",
    mcpAudience: env.MCP_AUDIENCE ?? "nexcort-mcp-watch",
    mcpIssuer: env.MCP_ISSUER,
    allowedHosts: env.MCP_ALLOWED_HOSTS ?? "mcp.nexcortiq.us",
    rateLimitPerHour: env.MCP_RATE_LIMIT_PER_HOUR,
    upstreamMaxAttempts: env.MCP_UPSTREAM_MAX_ATTEMPTS,
  });

  return {
    ...parsed,
    mcpIssuer: parsed.mcpIssuer ?? parsed.publicBaseUrl,
  };
}

export const WRITE_SCOPE = "watch:write";
export const ALLOWED_WRITE_ROLES = new Set(["rcsuperadmin", "rcadmin", "salescontractor"]);

/** Five ChatGPT Watch intelligence categories (must match shared schema). */
export const ALLOWED_WATCHES = [
  "psap_intelligence",
  "campus_intelligence",
  "venue_intelligence",
  "transit_intelligence",
  "competitor_intelligence",
] as const;

export type AllowedWatch = (typeof ALLOWED_WATCHES)[number];
