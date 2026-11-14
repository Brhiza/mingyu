import { safeStorage } from '@/lib/safe-storage';
import type { InstantTimeStandard } from 'mingyu-core/instant';

const DIVINATION_OBSERVER_STORAGE_KEY = 'mingyu:divination-observer:v1';

export interface DivinationObserverPreference {
  birthPlace: string;
  birthLongitude: string;
  birthLatitude: string;
  divinationTimeStandard: InstantTimeStandard;
}

const DEFAULT_PREFERENCE: DivinationObserverPreference = {
  birthPlace: '',
  birthLongitude: '',
  birthLatitude: '',
  divinationTimeStandard: 'beijing',
};

let memoryFallback: DivinationObserverPreference | null = null;

export function readDivinationObserverPreference(): DivinationObserverPreference {
  const raw =
    safeStorage.getJSON<Partial<DivinationObserverPreference> | null>(
      DIVINATION_OBSERVER_STORAGE_KEY,
      null,
    ) ?? memoryFallback;
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PREFERENCE };
  }
  const birthPlace = typeof raw.birthPlace === 'string' ? raw.birthPlace.trim() : '';
  const birthLongitude = typeof raw.birthLongitude === 'string' ? raw.birthLongitude.trim() : '';
  const birthLatitude = typeof raw.birthLatitude === 'string' ? raw.birthLatitude.trim() : '';
  const divinationTimeStandard: InstantTimeStandard =
    raw.divinationTimeStandard === 'true-solar' ? 'true-solar' : 'beijing';

  return {
    birthPlace,
    birthLongitude,
    birthLatitude,
    divinationTimeStandard,
  };
}

export function saveDivinationObserverPreference(
  patch: Partial<DivinationObserverPreference>,
): DivinationObserverPreference {
  const current = readDivinationObserverPreference();
  const next: DivinationObserverPreference = {
    birthPlace:
      patch.birthPlace !== undefined ? patch.birthPlace.trim() : current.birthPlace,
    birthLongitude:
      patch.birthLongitude !== undefined ? patch.birthLongitude.trim() : current.birthLongitude,
    birthLatitude:
      patch.birthLatitude !== undefined ? patch.birthLatitude.trim() : current.birthLatitude,
    divinationTimeStandard:
      patch.divinationTimeStandard === 'true-solar' || patch.divinationTimeStandard === 'beijing'
        ? patch.divinationTimeStandard
        : current.divinationTimeStandard,
  };
  memoryFallback = next;
  safeStorage.setJSON(DIVINATION_OBSERVER_STORAGE_KEY, next);
  return next;
}
