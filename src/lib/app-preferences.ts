import {
  GENERAL_DIVINATION_METHOD_OPTIONS,
  type DivinationMethodId,
} from 'mingyu-core/divination/config';
import { safeStorage } from '@/lib/safe-storage';

const APP_PREFERENCES_STORAGE_KEY = 'mingyu_app_preferences_v1';

export const APP_PREFERENCES_CHANGED_EVENT = 'mingyu:app-preferences-changed';

export type HomePreference =
  'unspecified' | 'dashboard' | 'single' | 'compatibility' | 'divination' | 'almanac';

export type CaseEntryPreference = 'recent' | 'new';

export type AppPreferences = {
  home: HomePreference;
  defaultDivinationMethod: DivinationMethodId;
  caseEntry: CaseEntryPreference;
};

export const defaultAppPreferences: AppPreferences = {
  home: 'dashboard',
  defaultDivinationMethod: 'random',
  caseEntry: 'recent',
};

const homePreferences = new Set<HomePreference>([
  'unspecified',
  'dashboard',
  'single',
  'compatibility',
  'divination',
  'almanac',
]);

const generalDivinationMethods = new Set<DivinationMethodId>(
  GENERAL_DIVINATION_METHOD_OPTIONS.map((item) => item.value),
);

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function readAppPreferences(): AppPreferences {
  const stored = safeStorage.getJSON<unknown>(APP_PREFERENCES_STORAGE_KEY, null);
  if (!isObjectRecord(stored)) {
    return defaultAppPreferences;
  }

  const home = homePreferences.has(stored.home as HomePreference)
    ? (stored.home as HomePreference)
    : defaultAppPreferences.home;
  const defaultDivinationMethod = generalDivinationMethods.has(
    stored.defaultDivinationMethod as DivinationMethodId,
  )
    ? (stored.defaultDivinationMethod as DivinationMethodId)
    : defaultAppPreferences.defaultDivinationMethod;
  const caseEntry =
    stored.caseEntry === 'new' || stored.caseEntry === 'recent'
      ? stored.caseEntry
      : defaultAppPreferences.caseEntry;

  return {
    home,
    defaultDivinationMethod,
    caseEntry,
  };
}

export function saveAppPreferences(preferences: AppPreferences) {
  const saved = safeStorage.setJSON(APP_PREFERENCES_STORAGE_KEY, preferences);
  if (saved && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APP_PREFERENCES_CHANGED_EVENT));
  }
  return saved;
}
