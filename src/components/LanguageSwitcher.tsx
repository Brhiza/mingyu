import { useI18n } from '@/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale, locales, t } = useI18n();
  return (
    <div className="lang-switcher" role="group" aria-label={t('lang.label')}>
      {locales.map((l) => (
        <button
          key={l.id}
          type="button"
          className={`lang-option${locale === l.id ? ' is-active' : ''}`}
          aria-pressed={locale === l.id}
          onClick={() => setLocale(l.id)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
