import * as React from 'react';
import { BookOpen, Check, ChevronDown, ChevronRight, Plus, Search, User, UserRoundX } from 'lucide-react';
import { formatBirthTimeText, type PersonalCase } from '../../v2-ui/cases-store';
import { cn } from '../../lib/utils';

export interface GlobalCaseSwitcherProps {
  cases: readonly PersonalCase[];
  activeCaseId: string | null;
  variant: 'desktop' | 'mobile';
  onSelectCase: (caseId: string | null) => void;
  onOpenManage: () => void;
  onNewCase: () => void;
}

function formatCaseShortDate(profile: PersonalCase): string {
  const cal = (profile.calendar ?? profile.dateType) === 'lunar' ? '农历' : '公历';
  const y = String(profile.year || '').trim();
  const m = String(profile.month || '').trim().padStart(2, '0');
  const d = String(profile.day || '').trim().padStart(2, '0');
  const datePart = y && m && d ? `${y}-${m}-${d}` : '日期待补';
  const timePart = formatBirthTimeText(profile);
  return `${cal} ${datePart} · ${timePart}`;
}

export function GlobalCaseSwitcher({
  cases,
  activeCaseId,
  variant,
  onSelectCase,
  onOpenManage,
  onNewCase,
}: GlobalCaseSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement>(null);

  const activeCase = React.useMemo(
    () => (activeCaseId ? cases.find((item) => item.id === activeCaseId) ?? null : null),
    [activeCaseId, cases],
  );

  const filteredCases = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter((item) => {
      const hay = `${item.name} ${item.birthPlace} ${item.year}-${item.month}-${item.day}`.toLowerCase();
      return hay.includes(q);
    });
  }, [cases, query]);

  React.useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handlePick = (nextId: string | null) => {
    setOpen(false);
    onSelectCase(nextId);
  };

  const displayName = activeCase ? activeCase.name?.trim() || '未命名' : variant === 'desktop' ? '无档案' : '档案';
  const initialChar = activeCase ? activeCase.name?.trim().slice(0, 1) || '' : '';

  return (
    <div ref={rootRef} className={cn('global-case-switcher', `is-${variant}`)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={activeCase ? `当前档案：${displayName}，点击切换` : '切换全局档案'}
        title={activeCase ? `当前档案：${displayName}` : '切换全局档案'}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'global-case-trigger',
          variant === 'desktop'
            ? 'workspace-topbar-action-btn inline-flex items-center gap-1.5'
            : 'inline-flex h-8 max-w-[108px] items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2 text-[12px] font-bold text-[var(--text-strong)] cursor-pointer transition-colors hover:border-[var(--accent)]',
          open && 'is-open',
          activeCase && 'has-active-case',
        )}
      >
        {initialChar ? (
          <span className="global-case-avatar-mini" aria-hidden="true">
            {initialChar}
          </span>
        ) : (
          <User className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
        )}
        <span className="truncate">{displayName}</span>
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 opacity-70 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          className="global-case-menu"
          role="menu"
          aria-label="全局档案切换菜单"
        >
          <div className="global-case-menu-head">
            <div className="flex items-center justify-between gap-2">
              <strong>当前档案</strong>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onNewCase();
                }}
                className="inline-flex items-center gap-0.5 border-0 bg-transparent p-0 text-[11.5px] font-bold text-[var(--accent-strong)] cursor-pointer hover:underline"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                <span>新建</span>
              </button>
            </div>
          </div>

          {cases.length > 6 ? (
            <label className="global-case-search">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
              <input
                type="search"
                autoComplete="off"
                placeholder="搜索档案…"
                aria-label="搜索可切换档案"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          ) : null}

          <div className="global-case-list">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={!activeCase}
              className={cn('global-case-item', !activeCase && 'is-selected')}
              onClick={() => handlePick(null)}
            >
              <span className="global-case-avatar is-none" aria-hidden="true">
                <UserRoundX className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="global-case-copy">
                <strong>不选档案</strong>
              </span>
              {!activeCase ? <Check className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" /> : null}
            </button>

            {filteredCases.map((profile) => {
              const selected = activeCase?.id === profile.id;
              const name = profile.name?.trim() || '未命名';
              return (
                <button
                  key={profile.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={cn('global-case-item', selected && 'is-selected')}
                  onClick={() => handlePick(profile.id)}
                >
                  <span className="global-case-avatar" aria-hidden="true">
                    {name.slice(0, 1)}
                  </span>
                  <span className="global-case-copy">
                    <strong>{name}</strong>
                    <small>{formatCaseShortDate(profile)}</small>
                  </span>
                  {selected ? <Check className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" /> : null}
                </button>
              );
            })}

            {cases.length > 0 && filteredCases.length === 0 ? (
              <p className="global-case-empty">没有找到匹配的档案</p>
            ) : null}
          </div>

          <button
            type="button"
            className="global-case-footer"
            onClick={() => {
              setOpen(false);
              onOpenManage();
            }}
          >
            <span className="inline-flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>管理全部档案</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
