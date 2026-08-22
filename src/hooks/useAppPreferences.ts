import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APP_PREFERENCES_CHANGED_EVENT,
  readAppPreferences,
  saveAppPreferences,
  type AppPreferences,
} from '@/lib/app-preferences';

export function useAppPreferences() {
  const [preferences, setPreferencesState] = useState<AppPreferences>(() => readAppPreferences());
  const preferencesRef = useRef(preferences);

  useEffect(() => {
    function syncPreferences() {
      const nextPreferences = readAppPreferences();
      preferencesRef.current = nextPreferences;
      setPreferencesState(nextPreferences);
    }

    window.addEventListener('storage', syncPreferences);
    window.addEventListener(APP_PREFERENCES_CHANGED_EVENT, syncPreferences);

    return () => {
      window.removeEventListener('storage', syncPreferences);
      window.removeEventListener(APP_PREFERENCES_CHANGED_EVENT, syncPreferences);
    };
  }, []);

  const setPreferences = useCallback(
    (next: AppPreferences | ((current: AppPreferences) => AppPreferences)) => {
      const resolved = typeof next === 'function' ? next(preferencesRef.current) : next;
      preferencesRef.current = resolved;
      saveAppPreferences(resolved);
      setPreferencesState(resolved);
    },
    [],
  );

  return [preferences, setPreferences] as const;
}
