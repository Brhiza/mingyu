import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { PageTopbar } from '@/components/PageTopbar';
import { lexicon, type LexiconCategory, type LexiconEntry } from '@/data/lexicon';

const CATEGORIES = ['全部', '天干', '地支', '五行', '十神', '紫微星曜', '基础', '神煞'] as const;
type CatFilter = (typeof CATEGORIES)[number];

export function LexiconPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<CatFilter>('全部');
  const [active, setActive] = useState<LexiconEntry | null>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lexicon.filter((e) => {
      if (cat !== '全部' && (e.category as LexiconCategory) !== cat) return false;
      if (!needle) return true;
      return (
        e.term.toLowerCase().includes(needle) ||
        e.pinyin.toLowerCase().includes(needle) ||
        e.definition.toLowerCase().includes(needle)
      );
    });
  }, [q, cat]);

  return (
    <>
      <PageTopbar title={t('lexicon.title')} onBack={() => navigate('/')} />
      <div className="lexicon-page">
        <p className="lexicon-subtitle">{t('lexicon.subtitle')}</p>
        <div className="lexicon-controls">
          <input
            className="lexicon-search"
            placeholder={t('lexicon.searchPlaceholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="lexicon-cats">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`lexicon-cat${cat === c ? ' is-active' : ''}`}
                onClick={() => setCat(c)}
              >
                {c === '全部' ? t('lexicon.all') : c}
              </button>
            ))}
          </div>
        </div>
        <p className="lexicon-count">
          {results.length} {t('lexicon.count')}
        </p>
        <div className="lexicon-layout">
          <ul className="lexicon-list">
            {results.map((e) => (
              <li key={`${e.term}-${e.category}`}>
                <button
                  type="button"
                  className={`lexicon-item${active === e ? ' is-active' : ''}`}
                  onClick={() => setActive(e)}
                >
                  <span className="lexicon-term">{e.term}</span>
                  <span className="lexicon-pinyin">{e.pinyin}</span>
                  <span className="lexicon-cat-tag">{e.category}</span>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="lexicon-empty">{t('lexicon.noResult')}</li>}
          </ul>
          {active && (
            <aside className="lexicon-detail glass-panel">
              <h3>
                {active.term} <span className="lexicon-pinyin">{active.pinyin}</span>
              </h3>
              <p className="lexicon-detail-cat">
                {t('lexicon.categoryLabel')}：{active.category}
              </p>
              <p className="lexicon-definition">{active.definition}</p>
              <p className="lexicon-source">
                {t('lexicon.source')}：{active.source}
              </p>
            </aside>
          )}
        </div>
      </div>
    </>
  );
}
