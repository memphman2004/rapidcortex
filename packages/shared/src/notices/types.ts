export type NoticeTargetType = "all" | "vertical" | "agency";
export type NoticeVertical = "core" | "campus" | "venue" | "hospital" | "transit";
export type NoticeSeverity = "info" | "warning" | "critical";
export type NoticeStatus = "active" | "expired" | "dismissed";

export interface PlatformNotice {
  noticeId: string;
  targetType: NoticeTargetType;
  targetVertical?: NoticeVertical;
  targetAgencyId?: string;
  severity: NoticeSeverity;
  title: string;
  message: string;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  expiresAt: number;
  expiresAtIso: string;
  dismissible: boolean;
  requiresAck: boolean;
}

export interface CreateNoticeInput {
  targetType: NoticeTargetType;
  targetVertical?: NoticeVertical;
  targetAgencyId?: string;
  severity: NoticeSeverity;
  title: string;
  message: string;
  expiresInHours?: number;
  dismissible?: boolean;
  requiresAck?: boolean;
}
