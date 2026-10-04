import type { UserContext } from "rapid-cortex-shared/types";

export type IQVertical = "911" | "campus" | "venue" | "transit" | "hospital";

export type IQTimeRange =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "month"
  | "quarter"
  | "year";

export interface IQDailyRecord {
  agencyId: string;
  vertical: IQVertical;
  date: string;
  metrics: Record<string, number>;
  hourlyBuckets: number[];
  updatedAt: string;
}

export interface IQKPIDefinition {
  key: string;
  label: string;
  format: "count" | "seconds" | "minutes" | "percentage" | "score";
  direction: "higher-better" | "lower-better" | "neutral";
  internalOnly?: boolean;
}

export interface IQVerticalConfig {
  name: string;
  badge: string;
  dashboards: string;
  kpis: IQKPIDefinition[];
  lineChartLabel: string;
  barBreakdownMetricPrefix: string;
}

export interface IQReportingPanelProps {
  agencyId: string;
  vertical: IQVertical;
  user: UserContext;
}

export const IQ_VERTICAL_ORDER: IQVertical[] = [
  "911",
  "campus",
  "venue",
  "transit",
  "hospital",
];
