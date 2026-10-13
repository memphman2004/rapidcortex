import type { NextFunction, Request, Response } from "express";

type LambdaHttpEvent = {
  body?: string | null;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
};

/**
 * Parse request body from the Lambda Function URL event without Express body-parser.
 * body-parser uses on-finished → req.on(), which serverless-express mock req lacks,
 * causing `TypeError: ee.on is not a function` and silent drops (ChatGPT timeouts).
 */
export function lambdaBodyParser(getEvent: () => LambdaHttpEvent | undefined) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body !== undefined && req.body !== null && typeof req.body === "object") {
      next();
      return;
    }

    const event = getEvent();
    const raw = event?.body;
    if (raw == null || raw === "") {
      req.body = undefined;
      next();
      return;
    }

    const text = event?.isBase64Encoded
      ? Buffer.from(raw, "base64").toString("utf8")
      : raw;

    const headers = event?.headers ?? {};
    let contentType = "";
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() === "content-type" && typeof v === "string") {
        contentType = v.toLowerCase();
        break;
      }
    }
    // Fallback to Express-normalized headers (local server)
    if (!contentType && typeof req.headers["content-type"] === "string") {
      contentType = req.headers["content-type"].toLowerCase();
    }

    try {
      if (contentType.includes("application/json")) {
        req.body = text ? JSON.parse(text) : {};
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        req.body = Object.fromEntries(new URLSearchParams(text));
      } else if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
        req.body = JSON.parse(text);
      } else {
        req.body = text;
      }
    } catch {
      req.body = undefined;
    }
    next();
  };
}

/** Local Node server: buffer JSON/urlencoded without on-finished edge cases. */
export function localBodyParser() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      next();
      return;
    }
    if (req.body !== undefined && req.body !== null && typeof req.body === "object") {
      next();
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      chunks.push(c);
    });
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8");
      const contentType = String(req.headers["content-type"] ?? "").toLowerCase();
      try {
        if (!text) {
          req.body = undefined;
        } else if (contentType.includes("application/x-www-form-urlencoded")) {
          req.body = Object.fromEntries(new URLSearchParams(text));
        } else {
          req.body = JSON.parse(text);
        }
      } catch {
        req.body = undefined;
      }
      next();
    });
    req.on("error", () => next());
  };
}
