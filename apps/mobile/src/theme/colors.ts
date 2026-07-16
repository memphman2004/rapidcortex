export const Colors = {
  // === VENUE / CAMPUS THEME (dark, enterprise) ===
  venue: {
    background: '#0A0F1E',
    surface: '#111827',
    surfaceAlt: '#1A2236',
    border: '#1E2D4A',
    amber: '#F59E0B',
    emerald: '#10B981',
    blue: '#1B4FD8',
    red: '#EF4444',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#475569',
  },

  // === SAFE & SOUND THEME (light, consumer) ===
  safeSound: {
    background: '#F8F9FB',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    border: '#E2E8F0',
    blue: '#1B4FD8',
    green: '#22C55E',
    amber: '#F59E0B',
    red: '#EF4444',
    purple: '#8B5CF6',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    textMuted: '#9CA3AF',
  },

  // === EMERGENCY OVERLAY (always dark, always accessible) ===
  emergency: {
    background: '#0D0D0D',
    countdown: '#EF4444',
    cancelButton: '#22C55E',
    cancelText: '#FFFFFF',
    textPrimary: '#FFFFFF',
    textSecondary: '#D1D5DB',
  },
} as const;

export type VenueColors = typeof Colors.venue;
export type SafeSoundColors = typeof Colors.safeSound;
export type EmergencyColors = typeof Colors.emergency;
export type ProductTheme = 'venue' | 'safeSound' | 'emergency';
