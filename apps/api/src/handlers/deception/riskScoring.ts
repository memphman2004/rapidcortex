import type { DeceptionEventType, DeceptionRiskLevel } from "./deceptionEvent.js";

export type RiskContext = {
  route: string;
  method: string;
  sourceIp: string;
  userAgent: string;
  eventType: DeceptionEventType;
  honeytokenKey?: string;
  decoyHitsLast10MinFromIp: number;
  distinctDecoyRoutesLast10Min: number;
  suspiciousUa: boolean;
  honeytokenHitsLast24hFromIp: number;
  touchedRealRouteRecently: boolean;
  isPostInternalSensitive: boolean;
};

function isSuspiciousUserAgent(ua: string): boolean {
  const u = ua.toLowerCase();
  if (!u.trim()) return true;
  if (/sqlmap|nikto|nmap|masscan|zgrab|gobuster|dirbuster|wfuzz/i.test(u)) return true;
  if ((u.startsWith("curl/") || u.startsWith("python-requests") || u.startsWith("python/")) && !u.includes("mozilla")) {
    return true;
  }
  return false;
}

export function detectSuspiciousUa(userAgent: string): boolean {
  return isSuspiciousUserAgent(userAgent);
}

/** Deterministic risk level from gathered context (call after DB correlation queries). */
export function scoreRisk(ctx: RiskContext): DeceptionRiskLevel {
  if (ctx.eventType === "CROSS_CONTAMINATION") return "CRITICAL";

  if (ctx.honeytokenHitsLast24hFromIp >= 2 && ctx.eventType === "HONEYTOKEN_USED") return "CRITICAL";

  if (ctx.touchedRealRouteRecently && (ctx.eventType === "DECOY_ROUTE_HIT" || ctx.eventType === "HONEYTOKEN_USED")) {
    return "CRITICAL";
  }

  if (ctx.isPostInternalSensitive) return "CRITICAL";

  if (ctx.honeytokenKey || ctx.eventType === "HONEYTOKEN_USED") return "HIGH";

  if (ctx.route === "/api/admin-backup" || ctx.route.startsWith("/api/internal/")) {
    return "HIGH";
  }

  if (ctx.decoyHitsLast10MinFromIp >= 3) return "MEDIUM";

  if (ctx.suspiciousUa) return "MEDIUM";

  if (ctx.distinctDecoyRoutesLast10Min >= 5) return "MEDIUM";

  return "LOW";
}

export function shouldAlertForRisk(level: DeceptionRiskLevel): boolean {
  return level === "HIGH" || level === "CRITICAL";
}
