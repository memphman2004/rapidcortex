/**
 * pii-scrubber.ts
 * Removes personally identifiable information from CAD narrative text
 * before it is shared with partner agencies.
 *
 * Applied to: narrative, aiSummary, transcript segments
 *
 * In production this should be backed by AWS Comprehend PII detection
 * for higher accuracy. The regex layer here acts as a fast pre-pass
 * and catches well-structured patterns (SSN, DOB, phone, etc.) with
 * near-zero latency before the async Comprehend call.
 */

import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
} from '@aws-sdk/client-comprehend';

const comprehend = new ComprehendClient({ region: process.env.AWS_REGION });

// ── Regex pre-pass (synchronous, fast) ───────────────────────────────────────

const PII_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  {
    name: 'ssn',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '[SSN REDACTED]',
  },
  {
    name: 'phone',
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE REDACTED]',
  },
  {
    name: 'dob',
    pattern: /\b(?:DOB|D\.O\.B\.?|born|date of birth)[:\s]+\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    replacement: '[DOB REDACTED]',
  },
  {
    name: 'dl',
    pattern: /\b(?:DL|D\.L\.|driver['\s]?s?\s+lic(?:ense)?)[:\s#]+[A-Z0-9]{6,12}\b/gi,
    replacement: '[DL REDACTED]',
  },
  {
    name: 'dob_raw',
    pattern: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,
    replacement: '[DATE REDACTED]',
  },
];

/**
 * Fast synchronous regex-based PII redaction.
 * Use this for low-latency paths (transcript streaming).
 */
export function scrubPIISync(text: string): string {
  let result = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Full PII scrub using both regex pre-pass and AWS Comprehend.
 * Use this for narrative and AI summary fields before sharing.
 */
export async function scrubPIIAsync(text: string): Promise<string> {
  // Quick regex pass first
  const preScrubbedText = scrubPIISync(text);

  try {
    const res = await comprehend.send(new DetectPiiEntitiesCommand({
      Text: preScrubbedText,
      LanguageCode: 'en',
    }));

    if (!res.Entities || res.Entities.length === 0) return preScrubbedText;

    // Sort entities by offset descending so replacements don't shift positions
    const sorted = [...res.Entities].sort(
      (a, b) => (b.EndOffset ?? 0) - (a.EndOffset ?? 0)
    );

    let result = preScrubbedText;
    for (const entity of sorted) {
      if (
        entity.BeginOffset !== undefined &&
        entity.EndOffset !== undefined &&
        (entity.Score ?? 0) >= 0.85
      ) {
        const label = comprehendLabel(entity);
        result =
          result.slice(0, entity.BeginOffset) +
          label +
          result.slice(entity.EndOffset);
      }
    }

    return result;
  } catch (e) {
    // Comprehend failure — return regex-only scrubbed version
    console.warn('[PII-SCRUBBER] Comprehend error, falling back to regex:', e);
    return preScrubbedText;
  }
}

/** Synchronous export for use in stream contexts */
export function scrubPII(text: string): string {
  return scrubPIISync(text);
}

function comprehendLabel(entity: { Type?: string }): string {
  const typeMap: Record<string, string> = {
    NAME: '[NAME REDACTED]',
    ADDRESS: '[ADDRESS REDACTED]',
    PHONE: '[PHONE REDACTED]',
    EMAIL: '[EMAIL REDACTED]',
    SSN: '[SSN REDACTED]',
    DATE_TIME: '[DATE REDACTED]',
    AGE: '[AGE REDACTED]',
    DRIVER_ID: '[DL REDACTED]',
    PASSPORT_NUMBER: '[PASSPORT REDACTED]',
    BANK_ACCOUNT_NUMBER: '[ACCOUNT REDACTED]',
    CREDIT_DEBIT_NUMBER: '[CARD REDACTED]',
    IP_ADDRESS: '[IP REDACTED]',
    URL: '[URL REDACTED]',
    LICENSE_PLATE: '[PLATE REDACTED]',
    VEHICLE_IDENTIFICATION_NUMBER: '[VIN REDACTED]',
  };
  return typeMap[entity.Type ?? ''] ?? '[PII REDACTED]';
}
