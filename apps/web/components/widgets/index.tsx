"use client";

/**
 * Dashboard widget library — all WidgetId slots have implementations.
 *
 * Structure:
 *   widget-primitives.tsx  — WidgetShell, StatCard, shared fetch helpers
 *   widget-core.tsx        — original operational widgets
 *   widget-stats.tsx       — stat-* cards
 *   widget-panels.tsx      — platform, QA, audit, admin panels
 *   widget-vertical.tsx    — campus, hospital, venue widgets
 *   widget-registry.ts     — complete WidgetId → component map
 */

export type { WidgetProps } from "./widget-primitives";
export { WIDGET_REGISTRY } from "./widget-registry";
