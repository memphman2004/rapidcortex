/** First non-empty trimmed value (runtime server env before inlined NEXT_PUBLIC_*). */
function firstNonEmpty(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function getCognitoClientId(): string | null {
  return (
    firstNonEmpty(process.env.COGNITO_CLIENT_ID, process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID) ??
    null
  );
}

export function getCognitoUserPoolId(): string | null {
  return (
    firstNonEmpty(
      process.env.COGNITO_USER_POOL_ID,
      process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
    ) ?? null
  );
}

export function getCognitoDomain(): string | null {
  return (
    firstNonEmpty(process.env.COGNITO_DOMAIN, process.env.NEXT_PUBLIC_COGNITO_DOMAIN) ?? null
  );
}

export function getCognitoRegion(): string {
  return (
    firstNonEmpty(
      process.env.COGNITO_REGION,
      process.env.NEXT_PUBLIC_COGNITO_REGION,
      process.env.AWS_REGION,
    ) ?? "us-east-1"
  );
}
