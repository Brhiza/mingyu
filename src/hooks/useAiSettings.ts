import { useCallback, useEffect, useState } from 'react';
import {
  AI_SETTINGS_EVENT,
  readAiSettings,
  saveAiSettings,
  type AiSettings,
} from '@/lib/ai/settings';

export function useAiSettings() {
  const [settings, setSettingsState] = useState<AiSettings>(() => readAiSettings());

  useEffect(() => {
    function syncSettings() {
      setSettingsState(readAiSettings());
    }

    window.addEventListener('storage', syncSettings);
    window.addEventListener(AI_SETTINGS_EVENT, syncSettings);

    return () => {
      window.removeEventListener('storage', syncSettings);
      window.removeEventListener(AI_SETTINGS_EVENT, syncSettings);
    };
  }, []);

  const setSettings = useCallback((next: AiSettings | ((current: AiSettings) => AiSettings)) => {
    setSettingsState((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      saveAiSettings(resolved);
      return resolved;
    });
  }, []);

  return [settings, setSettings] as const;
}
