import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
  formatDistanceToNow,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';

export function formatRelativeTime(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate;
  const now = new Date();
  const minutes = differenceInMinutes(now, date);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = differenceInHours(now, date);
  if (hours < 24) return hours === 1 ? '1 hr ago' : `${hours} hrs ago`;

  const days = differenceInDays(now, date);
  if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;

  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatTimestamp(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate;

  if (isToday(date)) {
    return `Today at ${format(date, 'h:mm a')}`;
  }

  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`;
  }

  return format(date, 'MMM d, yyyy h:mm a');
}

export function formatDateShort(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate;
  return format(date, 'MMM d, yyyy');
}

export function formatTime(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate;
  return format(date, 'h:mm a');
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';

  if (meters < 1) return '< 1 m';
  if (meters < 1000) return `${Math.round(meters)} m`;

  const km = meters / 1000;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export function formatDistanceImperial(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '—';

  const feet = meters * 3.28084;
  if (feet < 5280) return `${Math.round(feet)} ft`;

  const miles = feet / 5280;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

export type BatteryLevel = 'high' | 'medium' | 'low' | 'critical';

export function getBatteryLevel(percent: number): BatteryLevel {
  if (!Number.isFinite(percent)) return 'critical';
  if (percent > 50) return 'high';
  if (percent >= 20) return 'medium';
  if (percent >= 10) return 'low';
  return 'critical';
}

export function formatBatteryPercent(percent: number): string {
  if (!Number.isFinite(percent)) return '—';
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return `${clamped}%`;
}

/**
 * Estimates remaining battery days for Guardian devices.
 * Assumes linear drain from current percentage over a 30-day nominal cycle.
 */
export function formatBatteryDaysRemaining(percent: number): string {
  if (!Number.isFinite(percent) || percent <= 0) return 'Replace soon';
  if (percent >= 100) return '30+ days';

  const days = Math.round((percent / 100) * 30);
  if (days <= 1) return 'Less than 1 day';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export function formatAccuracyMeters(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return 'Unknown accuracy';
  return `±${Math.round(meters)} m`;
}

export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }
  if (digits.length === 10) {
    const area = digits.slice(0, 3);
    const prefix = digits.slice(3, 6);
    const line = digits.slice(6, 10);
    return `(${area}) ${prefix}-${line}`;
  }
  return e164;
}
