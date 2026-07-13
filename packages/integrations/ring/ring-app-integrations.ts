const AVA_BASE = "https://api.amazonvision.com/v1";

export type RingAppIntegrationPostResult = {
  status: string;
};

export type RingAppIntegrationPatchResult = {
  account_identifier?: string;
  status: string;
  updated_at?: string;
};

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * POST /accounts/me/app-integrations — confirm nonce + partner account_identifier.
 * Transitions Ring integration to `awaiting` and activates device consents.
 */
export async function postRingAppIntegration(
  accessToken: string,
  body: { account_identifier: string; nonce: string },
): Promise<RingAppIntegrationPostResult> {
  const response = await fetch(`${AVA_BASE}/accounts/me/app-integrations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(
      `Ring App-Integrations POST failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }
  const record = (payload ?? {}) as Record<string, unknown>;
  return { status: String(record.status ?? "awaiting") };
}

/**
 * PATCH /accounts/me/app-integrations — mandatory finalize with status: completed.
 */
export async function patchRingAppIntegrationCompleted(
  accessToken: string,
  accountIdentifier?: string,
): Promise<RingAppIntegrationPatchResult> {
  const body: Record<string, string> = { status: "completed" };
  if (accountIdentifier) body.account_identifier = accountIdentifier;

  const response = await fetch(`${AVA_BASE}/accounts/me/app-integrations`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw new Error(
      `Ring App-Integrations PATCH failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }
  const record = (payload ?? {}) as Record<string, unknown>;
  return {
    status: String(record.status ?? "completed"),
    ...(record.account_identifier != null
      ? { account_identifier: String(record.account_identifier) }
      : {}),
    ...(record.updated_at != null ? { updated_at: String(record.updated_at) } : {}),
  };
}
