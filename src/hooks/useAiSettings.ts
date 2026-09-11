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
    const resolved = typeof next === 'function' ? next(readAiSettings()) : next;
    saveAiSettings(resolved);
    setSettingsState(resolved);
  }, []);

  return [settings, setSettings] as const;
}
