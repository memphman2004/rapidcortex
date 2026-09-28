/**
 * Copyright / IP copy — single source of truth for content-protection UI.
 * Brand: NexCort iQ (Apps on Demand LLC). Rapid Cortex remains a supported product name.
 */
export const COPYRIGHT = {
  company: "Apps on Demand LLC",
  brand: "NexCort iQ",
  legacyBrand: "Rapid Cortex",
  yearStart: 2025,
  yearCurrent: new Date().getFullYear(),
  email: "legal@rapidcortex.us",
  website: "https://www.rapidcortex.us",

  notice(short = false): string {
    const year = `${this.yearStart}–${new Date().getFullYear()}`;
    if (short) {
      return `© ${year} Apps on Demand LLC d/b/a NexCort iQ. All rights reserved.`;
    }
    return [
      `© ${year} Apps on Demand LLC d/b/a NexCort iQ ("NexCort iQ").`,
      `All content, text, graphics, user interfaces, trademarks, logos, computer code,`,
      `and associated documentation on this website is the exclusive property of Apps on Demand LLC`,
      `and is protected by United States and international intellectual property laws.`,
      `No portion may be copied, reproduced, republished, or distributed without prior written consent.`,
    ].join(" ");
  },

  get shortNotice(): string {
    return `© ${new Date().getFullYear()} Apps on Demand LLC d/b/a NexCort iQ. All rights reserved. Unauthorized reproduction is prohibited and may be monitored.`;
  },

  accessWarning:
    "This platform and its content — including product descriptions, feature language, pricing structures, architectural diagrams, and workflow documentation — is proprietary. Unauthorized copying, reproduction, or distribution is prohibited. Sessions may be logged with IP address, timestamp, and user identity.",
} as const;
