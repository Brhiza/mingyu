import {
  GENERAL_DIVINATION_METHOD_OPTIONS,
  type DivinationMethodId,
} from 'mingyu-core/divination/config';
import { safeStorage } from '@/lib/safe-storage';
import {
  DEFAULT_WORKSPACE_NAVIGATION_ORDER,
  isWorkspaceEntryId,
  normalizeWorkspaceNavigationOrder,
  type WorkspaceHomePreference,
  type WorkspaceEntryId,
} from '@/lib/workspace-navigation';

const APP_PREFERENCES_STORAGE_KEY = 'mingyu_app_preferences_v1';

export const APP_PREFERENCES_CHANGED_EVENT = 'mingyu:app-preferences-changed';

export type CaseEntryPreference = 'recent' | 'new';

export type AppPreferences = {
  home: WorkspaceHomePreference;
  defaultDivinationMethod: DivinationMethodId;
  caseEntry: CaseEntryPreference;
  navigationOrder: WorkspaceEntryId[];
};

export const defaultAppPreferences: AppPreferences = {
  home: 'bazi',
  defaultDivinationMethod: 'random',
  caseEntry: 'recent',
  navigationOrder: [...DEFAULT_WORKSPACE_NAVIGATION_ORDER],
};

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

  const storedHome = stored.home;
  const home: WorkspaceHomePreference =
    storedHome === 'unspecified'
      ? 'unspecified'
      : isWorkspaceEntryId(storedHome)
        ? storedHome
        : storedHome === 'compatibility' || storedHome === 'almanac'
          ? storedHome
          : storedHome === 'divination'
            ? 'random'
            : 'bazi';
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
    navigationOrder: normalizeWorkspaceNavigationOrder(stored.navigationOrder),
  };
}

export function saveAppPreferences(preferences: AppPreferences) {
  const saved = safeStorage.setJSON(APP_PREFERENCES_STORAGE_KEY, preferences);
  if (saved && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APP_PREFERENCES_CHANGED_EVENT));
  }
  return saved;
}
