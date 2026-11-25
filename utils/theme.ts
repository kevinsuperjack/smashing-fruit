export type AppTheme = 'ORCHARD' | 'CHRISTMAS';

export const APP_THEME_STORAGE_KEY = 'juicyDrop_appTheme_v1';

export interface AppThemePalette {
  id: AppTheme;
  label: string;
  shortLabel: string;
  emoji: string;
  hubBgClass: string;
  hubHeaderBadgeClass: string;
  hubTextClass: string;
  cardBorderAccent: string;
}

export const APP_THEMES: Record<AppTheme, AppThemePalette> = {
  ORCHARD: {
    id: 'ORCHARD',
    label: 'Cozy Orchard',
    shortLabel: 'Orchard',
    emoji: '☀️',
    hubBgClass: 'bg-gradient-to-b from-[#FDF6E3] via-[#F7EFE2] to-[#EAD8C0]',
    hubHeaderBadgeClass: 'bg-[#FFF9F0] border-2 border-[#C89666] text-[#5C3A21]',
    hubTextClass: 'text-[#4A2810]',
    cardBorderAccent: 'border-[#F3E3CF] ring-1 ring-amber-100/40',
  },
  CHRISTMAS: {
    id: 'CHRISTMAS',
    label: 'Christmas Wonderland',
    shortLabel: 'Christmas',
    emoji: '🎄',
    hubBgClass: 'bg-gradient-to-b from-slate-900 via-emerald-950 to-indigo-950',
    hubHeaderBadgeClass:
      'bg-emerald-950/90 border-2 border-amber-300/80 text-amber-100',
    hubTextClass: 'text-amber-50',
    cardBorderAccent:
      'border-amber-300/90 ring-2 ring-amber-200/50 shadow-amber-500/20',
  },
};

export function loadAppTheme(): AppTheme {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage || typeof storage.getItem !== 'function') {
      return 'ORCHARD';
    }
    const saved = storage.getItem(APP_THEME_STORAGE_KEY);
    return saved === 'CHRISTMAS' ? 'CHRISTMAS' : 'ORCHARD';
  } catch {
    return 'ORCHARD';
  }
}

export function saveAppTheme(theme: AppTheme): void {
  try {
    const storage = (globalThis as { localStorage?: Storage }).localStorage;
    if (!storage || typeof storage.setItem !== 'function') {
      return;
    }
    const normalized: AppTheme = theme === 'CHRISTMAS' ? 'CHRISTMAS' : 'ORCHARD';
    storage.setItem(APP_THEME_STORAGE_KEY, normalized);
  } catch {
    // Ignore unavailable, private-mode, or quota-exceeded storage errors
  }
}
