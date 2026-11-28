import * as React from 'react';
import { Check, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { formatBirthTimeText, sortPersonalCases, type PersonalCase } from '../../v2-ui/cases-store';
import type { PersonRole } from './person/person-form-helpers';
import {
  Badge,
  Button,
  Card,
  Drawer,
  DrawerContent,
  DrawerHeader,
  Input,
  PageHeader,
  PanelTitle,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from './ConfirmDialog';

export interface CaseFillTarget {
  role: PersonRole;
  applyCase: (person: PersonalCase, isTemporary: boolean) => void;
}

type CasesFilter = 'all' | 'pinned';

const CASES_FILTER_OPTIONS: ReadonlyArray<{ id: CasesFilter; label: string }> = [
  { id: 'all', label: '全部档案' },
  { id: 'pinned', label: '已置顶' },
];

export interface CasesPageProps {
  cases: PersonalCase[];
  activeCaseId?: string | null;
  onSelectActiveCase?: (id: string | null) => void;
  onNewCase: () => void;
  onEditCase: (record: PersonalCase) => void;
  onOpenChart: (record: PersonalCase) => void;
  onTogglePin: (id: string) => void;
  onDeleteCase: (record: PersonalCase) => void;
}

export interface CasesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cases: PersonalCase[];
  fillTarget: CaseFillTarget | null;
  onNewCase: () => void;
  onEditCase: (record: PersonalCase) => void;
  onFillCase: (record: PersonalCase) => void;
  onOpenChart: (record: PersonalCase) => void;
  onTogglePin: (id: string) => void;
  onDeleteCase: (record: PersonalCase) => void;
}

function useFilteredCases(cases: readonly PersonalCase[], filter: CasesFilter, keyword: string) {
  const sortedCases = React.useMemo(() => sortPersonalCases(cases, 'recent'), [cases]);
  const kw = keyword.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      sortedCases.filter((c) => {
        if (filter === 'pinned' && !c.pinned) return false;
        if (!kw) return true;
        return `${c.name} ${c.birthText} ${c.birthPlace}`.toLowerCase().includes(kw);
      }),
    [sortedCases, filter, kw],
  );
  return { sortedCases, filtered };
}

function CaseListRows({
  items,
  totalCount,
  emptyTitle,
  activeCaseId,
  mode,
  onPrimaryAction,
  onSetActiveCase,
  onEditCase,
  onTogglePin,
  onAskDelete,
  onNewCase,
}: {
  items: PersonalCase[];
  totalCount: number;
  emptyTitle?: string;
  activeCaseId?: string | null;
  mode: 'page' | 'picker';
  onPrimaryAction: (record: PersonalCase) => void;
  onSetActiveCase?: (id: string | null) => void;
  onEditCase: (record: PersonalCase) => void;
  onTogglePin: (id: string) => void;
  onAskDelete: (record: PersonalCase) => void;
  onNewCase?: () => void;
}) {
  const [openMenuId, setOpenMenuId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!openMenuId) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-case-row-menu]')) return;
      setOpenMenuId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenuId]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-5 py-10 text-center">
        <span
          aria-hidden="true"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--state-selected-surface)] text-[var(--accent-strong)]"
        >
          <FolderOpen className="h-5 w-5" aria-hidden="true" />
        </span>
        <strong className="text-sm font-bold text-[var(--text-strong)]">
          {emptyTitle ?? (totalCount ? '没有匹配的个人档案' : '尚未保存个人档案')}
        </strong>
        {!totalCount && onNewCase ? (
          <Button variant="primary" size="sm" className="mt-1" onClick={onNewCase}>
            <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>新建档案</span>
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((record, index) => {
        const dateModeLabel = record.reverseSource
          ? '四柱'
          : record.calendar === 'lunar'
            ? '农历'
            : '公历';
        const birthSummary = `${dateModeLabel} ${record.birthText} ${formatBirthTimeText(record)}`;
        const isCurrent = Boolean(activeCaseId && activeCaseId === record.id);
        const menuOpen = openMenuId === record.id;
        const openUpward = items.length > 1 && index >= items.length - 1;
        return (
          <article
            key={record.id}
            className={cn(
              'workspace-drawer-flat-row group flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors',
              record.pinned
                ? 'is-pinned border-[color-mix(in_srgb,var(--accent)_30%,var(--border-soft))] bg-[color-mix(in_srgb,var(--state-selected-surface)_55%,var(--surface-elevated))]'
                : 'border-[var(--border-soft)] bg-[var(--surface-elevated)] hover:border-[var(--border-contrast)] hover:bg-[var(--surface-base)]',
            )}
          >
            <button
              type="button"
              onClick={() => onPrimaryAction(record)}
              className="flex min-h-[44px] min-w-0 flex-1 flex-col items-start justify-center gap-1 border-0 bg-transparent p-0 text-left cursor-pointer"
            >
              <div className="flex max-w-full flex-wrap items-center gap-1.5">
                <strong className="truncate text-[13.5px] font-bold text-[var(--text-strong)]">
                  {record.name}
                </strong>
                {record.pinned ? (
                  <Pin
                    aria-label="已置顶"
                    className="h-3 w-3 shrink-0 fill-current text-[var(--accent-strong)]"
                  />
                ) : null}
                <Badge
                  variant={record.gender === 'male' ? 'outline' : 'accent'}
                  className="px-1.5 py-0 text-[10.5px]"
                >
                  {record.gender === 'male' ? '男' : '女'}
                </Badge>
                {isCurrent ? (
                  <Badge variant="good" className="px-1.5 py-0 text-[10.5px]">
                    当前
                  </Badge>
                ) : null}
              </div>
              <span className="max-w-full truncate text-[12px] text-[var(--text-muted)]">
                {birthSummary}
                {record.birthPlace ? ` · ${record.birthPlace}` : ''}
              </span>
            </button>

            {/* 桌面端快捷操作按钮 */}
            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              {mode === 'picker' ? (
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => onPrimaryAction(record)}
                >
                  填入
                </Button>
              ) : onSetActiveCase && !isCurrent ? (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-[var(--text-secondary)]"
                  onClick={() => onSetActiveCase(record.id)}
                >
                  设为当前
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--text-muted)]"
                title="编辑档案"
                aria-label="编辑档案"
                onClick={() => onEditCase(record)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8',
                  record.pinned
                    ? 'text-[var(--accent-strong)]'
                    : 'text-[var(--text-muted)]',
                )}
                title={record.pinned ? '取消置顶' : '置顶档案'}
                aria-label={record.pinned ? '取消置顶' : '置顶档案'}
                onClick={() => onTogglePin(record.id)}
              >
                {record.pinned ? (
                  <Pin className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <PinOff className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--danger-text)_10%,transparent)] hover:text-[var(--danger-text)]"
                title="删除档案"
                aria-label="删除档案"
                onClick={() => onAskDelete(record)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* 移动端收口操作菜单：隔离删除按钮防止误触 */}
            <div data-case-row-menu className="relative flex shrink-0 items-center gap-1.5 sm:hidden">
              {mode === 'picker' ? (
                <Button
                  variant="primary"
                  size="xs"
                  className="h-8 px-2.5"
                  onClick={() => onPrimaryAction(record)}
                >
                  填入
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid={`case-more-${record.id}`}
                aria-label="更多操作"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setOpenMenuId((prev) => (prev === record.id ? null : record.id))}
                className="h-9 w-9 text-[var(--text-secondary)] hover:bg-[var(--surface-soft)]"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>

              {menuOpen ? (
                <div
                  role="menu"
                  aria-label={`${record.name} 操作菜单`}
                  className={cn(
                    'absolute right-0 z-30 min-w-[144px] rounded-xl border border-[var(--border-contrast)] bg-[var(--surface-elevated-strong)] p-1 shadow-[0_10px_28px_rgba(32,24,16,0.16)]',
                    openUpward ? 'bottom-[calc(100%+4px)]' : 'top-[calc(100%+4px)]',
                  )}
                >
                  {mode === 'page' && onSetActiveCase && !isCurrent ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpenMenuId(null);
                        onSetActiveCase(record.id);
                      }}
                      className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-soft)]"
                    >
                      <Check className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                      <span>设为当前</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuId(null);
                      onEditCase(record);
                    }}
                    className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-soft)]"
                  >
                    <Pencil className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <span>编辑档案</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuId(null);
                      onTogglePin(record.id);
                    }}
                    className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] font-medium text-[var(--text-primary)] cursor-pointer hover:bg-[var(--surface-soft)]"
                  >
                    {record.pinned ? (
                      <PinOff className="h-3.5 w-3.5 text-[var(--accent-strong)]" />
                    ) : (
                      <Pin className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    )}
                    <span>{record.pinned ? '取消置顶' : '置顶档案'}</span>
                  </button>
                  <div className="my-1 h-px bg-[var(--border-soft)]" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpenMenuId(null);
                      onAskDelete(record);
                    }}
                    className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-left text-[12.5px] font-medium text-[var(--danger-text)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--danger-text)_10%,transparent)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>删除档案</span>
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

/** 个人档案独立子页（与历史记录页保持一致的 760px 居中极简卡片布局） */
export function CasesPage({
  cases,
  activeCaseId = null,
  onSelectActiveCase,
  onNewCase,
  onEditCase,
  onOpenChart,
  onTogglePin,
  onDeleteCase,
}: CasesPageProps) {
  const [keyword, setKeyword] = React.useState('');
  const [filter, setFilter] = React.useState<CasesFilter>('all');
  const [pendingDelete, setPendingDelete] = React.useState<PersonalCase | null>(null);

  const { sortedCases, filtered } = useFilteredCases(cases, filter, keyword);

  return (
    <div
      data-testid="cases-page"
      className="mx-auto flex w-full min-w-0 max-w-[var(--workspace-canvas-form,760px)] flex-col gap-4 pb-10"
    >
      <PageHeader
        title="个人档案"
        rightSlot={
          <div className="ws-desktop-only-action hidden min-[680px]:inline-flex items-center gap-2">
            <Badge variant="outline">
              共 {filtered.length} 份
            </Badge>
            <Button variant="primary" size="sm" onClick={onNewCase}>
              <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>新建档案</span>
            </Button>
          </div>
        }
      />

      <Card className="flex w-full min-w-0 flex-col gap-3 sm:gap-4 overflow-visible rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5 sm:p-5 shadow-[0_2px_12px_rgba(32,24,16,0.035)]">
        <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div
              className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="tablist"
              aria-label="档案筛选"
            >
              {CASES_FILTER_OPTIONS.map((opt) => {
                const active = filter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(opt.id)}
                    className={cn(
                      'h-8 shrink-0 rounded-full border px-3 text-[11.5px] sm:text-xs whitespace-nowrap cursor-pointer transition-colors',
                      active
                        ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface-strong)] font-bold text-[var(--state-selected-text)]'
                        : 'border-[var(--border-soft)] bg-[var(--surface-soft)] font-medium text-[var(--text-secondary)] hover:text-[var(--text-strong)]',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <span className="shrink-0 text-[12px] text-[var(--text-muted)] min-[680px]:hidden">
              {filtered.length} 份
            </span>
          </div>

          <div className="flex items-center gap-2 min-w-0 sm:w-[240px] min-[680px]:w-[240px]">
            <Input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索姓名、生辰或出生地..."
              className="flex-1 min-w-0"
            />
            <Button
              variant="primary"
              size="sm"
              className="h-9 shrink-0 px-3 min-[680px]:hidden"
              onClick={onNewCase}
            >
              <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>新建</span>
            </Button>
          </div>
        </div>

        <CaseListRows
          items={filtered}
          totalCount={sortedCases.length}
          emptyTitle={
            filter === 'pinned' && !keyword.trim()
              ? '尚未置顶个人档案'
              : sortedCases.length
                ? '没有匹配的个人档案'
                : '尚未保存个人档案'
          }
          activeCaseId={activeCaseId}
          mode="page"
          onPrimaryAction={onOpenChart}
          onSetActiveCase={onSelectActiveCase}
          onEditCase={onEditCase}
          onTogglePin={onTogglePin}
          onAskDelete={setPendingDelete}
          onNewCase={onNewCase}
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title="删除个人档案"
        message={
          pendingDelete ? `确定删除“${pendingDelete.name}”吗？删除后无法恢复。` : ''
        }
        onConfirm={() => {
          if (pendingDelete) onDeleteCase(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}

/** 表单内「从档案调取」临时抽屉选择器（不离开当前表单上下文） */
export function CasesDrawer({
  open,
  onOpenChange,
  cases,
  fillTarget,
  onNewCase,
  onEditCase,
  onFillCase,
  onOpenChart,
  onTogglePin,
  onDeleteCase,
}: CasesDrawerProps) {
  const [keyword, setKeyword] = React.useState('');
  const [pendingDelete, setPendingDelete] = React.useState<PersonalCase | null>(null);

  React.useEffect(() => {
    if (!open) setKeyword('');
  }, [open]);

  const { sortedCases, filtered } = useFilteredCases(cases, 'all', keyword);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent data-testid="cases-drawer" aria-label="个人生辰档案抽屉">
          <DrawerHeader onClose={() => onOpenChange(false)}>
            <PanelTitle>
              {fillTarget
                ? `选择档案 · ${fillTarget.role === 'partner' ? '命主二' : '命主一'}`
                : '选择档案'}
            </PanelTitle>
          </DrawerHeader>

          <div className="flex shrink-0 flex-col gap-2.5 border-b border-[var(--border-soft)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Input
                type="search"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索姓名或生辰..."
                className="flex-1"
              />
              <Button
                variant="primary"
                size="sm"
                className="workspace-drawer-new-btn shrink-0"
                onClick={onNewCase}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                <span>新建档案</span>
              </Button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-3">
            <CaseListRows
              items={filtered}
              totalCount={sortedCases.length}
              mode={fillTarget ? 'picker' : 'page'}
              onPrimaryAction={(record) => (fillTarget ? onFillCase(record) : onOpenChart(record))}
              onEditCase={onEditCase}
              onTogglePin={onTogglePin}
              onAskDelete={setPendingDelete}
              onNewCase={onNewCase}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title="删除个人档案"
        message={
          pendingDelete ? `确定删除“${pendingDelete.name}”吗？删除后无法恢复。` : ''
        }
        onConfirm={() => {
          if (pendingDelete) onDeleteCase(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
