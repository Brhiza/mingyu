import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { safeStorage } from '@/lib/safe-storage';
import { zhCN, type Dict } from './locales/zh-CN';
import { en } from './locales/en';
import { ja } from './locales/ja';
import { koKN } from './locales/ko-KN';
import { viVN } from './locales/vi-VN';
import { thTH } from './locales/th-TH';
import { esES } from './locales/es-ES';

export type Locale = 'zh-CN' | 'en' | 'ja' | 'ko-KN' | 'vi-VN' | 'th-TH' | 'es-ES';
const DICTS: Record<Locale, Dict> = {
  'zh-CN': zhCN,
  en,
  ja,
  'ko-KN': koKN,
  'vi-VN': viVN,
  'th-TH': thTH,
  'es-ES': esES,
};

const LOCALE_KEY = 'ts_locale';
const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en', 'ja', 'ko-KN', 'vi-VN', 'th-TH', 'es-ES'];
function readStoredLocale(): Locale {
  const v = safeStorage.get(LOCALE_KEY);
  return (SUPPORTED_LOCALES as string[]).includes(v) ? (v as Locale) : 'zh-CN';
}
function translate(dict: Dict, key: string): string {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return key;
    }
  }
  return typeof cur === 'string' ? cur : key;
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  locales: { id: Locale; label: string }[];
};

const I18nContext = createContext<I18nContextValue | null>(null);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale());
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    safeStorage.set(LOCALE_KEY, l);
  }, []);
  const t = useCallback((key: string) => translate(DICTS[locale], key), [locale]);
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      locales: [
        { id: 'zh-CN', label: DICTS['zh-CN'].lang.zh },
        { id: 'en', label: DICTS.en.lang.en },
        { id: 'ja', label: DICTS.ja.lang.ja },
        { id: 'ko-KN', label: DICTS['ko-KN'].lang.ko },
        { id: 'vi-VN', label: DICTS['vi-VN'].lang.vi },
        { id: 'th-TH', label: DICTS['th-TH'].lang.th },
        { id: 'es-ES', label: DICTS['es-ES'].lang.es },
      ],
    }),
    [locale, setLocale, t],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}