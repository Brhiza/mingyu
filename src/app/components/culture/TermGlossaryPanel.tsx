import * as React from 'react';
import { BookOpen, Search } from 'lucide-react';
import termsData from '../../../data/terms.json';
import { Button, Card, Input } from '../../../components/ui';

interface MetaphysicsTerm {
  term: string;
  category: string;
  pinyin?: string;
  summary: string;
  positive?: string;
  negative?: string;
  advice?: string;
  detail?: string;
  classicRef?: string;
  aliases?: string[];
  tags?: string[];
}

const ALL_TERMS = termsData as readonly MetaphysicsTerm[];
const CATEGORIES = ['全部', ...Array.from(new Set(ALL_TERMS.map((item) => item.category)))];

export function TermGlossaryPanel() {
  const [query, setQuery] = React.useState('');
  const [category, setCategory] = React.useState('全部');
  const [selected, setSelected] = React.useState<MetaphysicsTerm | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_TERMS.filter((item) => {
      if (category !== '全部' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.term.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        (item.aliases ?? []).some((a) => a.toLowerCase().includes(q)) ||
        (item.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }).slice(0, 60);
  }, [category, query]);

  return (
    <div className="grid gap-3">
      <Card className="grid gap-3 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            type="text"
            value={query}
            placeholder="搜索术数术语，例如：天乙贵人、化忌、用神、伏吟"
            className="pl-9"
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
            }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              type="button"
              size="xs"
              variant={category === cat ? 'pillActive' : 'pill'}
              onClick={() => {
                setCategory(cat);
                setSelected(null);
              }}
            >
              {cat}
            </Button>
          ))}
        </div>
      </Card>

      {selected ? (
        <Card className="grid gap-2.5 p-4 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <strong className="text-base text-[var(--text-strong)]">{selected.term}</strong>
              {selected.pinyin ? <span className="text-[var(--text-muted)]">{selected.pinyin}</span> : null}
            </div>
            <Button type="button" variant="ghost" size="xs" onClick={() => setSelected(null)}>
              返回列表
            </Button>
          </div>
          <p className="m-0 leading-relaxed text-[var(--text-primary)]">{selected.summary}</p>
          {selected.detail ? <p className="m-0 leading-relaxed text-[var(--text-secondary)]">{selected.detail}</p> : null}
          {selected.positive ? <p className="m-0 text-[var(--text-secondary)]">{`吉象：${selected.positive}`}</p> : null}
          {selected.negative ? <p className="m-0 text-[var(--text-secondary)]">{`留意：${selected.negative}`}</p> : null}
          {selected.advice ? <p className="m-0 text-[var(--text-secondary)]">{`参考：${selected.advice}`}</p> : null}
          {selected.classicRef ? (
            <p className="m-0 rounded-lg bg-[var(--surface-soft)] p-2.5 text-[var(--text-muted)]">
              {selected.classicRef}
            </p>
          ) : null}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {filtered.map((item) => (
            <button
              key={`${item.category}-${item.term}`}
              type="button"
              onClick={() => setSelected(item)}
              className="grid gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-3 text-left transition-colors hover:border-[var(--border-contrast)] cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="flex items-center gap-1.5 text-sm text-[var(--text-strong)]">
                  <BookOpen className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                  <span>{item.term}</span>
                </strong>
                <span className="rounded bg-[var(--surface-soft)] px-1.5 py-0.5 text-[10.5px] text-[var(--text-muted)]">
                  {item.category}
                </span>
              </div>
              <span className="line-clamp-2 text-xs text-[var(--text-secondary)]">{item.summary}</span>
            </button>
          ))}
          {filtered.length === 0 ? (
            <Card className="p-6 text-center text-xs text-[var(--text-muted)] sm:col-span-2">
              未找到匹配术语
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
