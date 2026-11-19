import * as React from 'react';
import { ArrowUpRight, Clock, Trash2 } from 'lucide-react';
import type { Method } from '../../core';
import { methodLabels } from '../../schema';
import type { CompatibilityRecord, DivinationRecord } from '../../v2-ui/cases-store';
import type { AgentChatSession } from '../../web-agent';
import { Badge, Button, Card, Input, PageHeader } from '../../components/ui';
import { cn } from '../../lib/utils';
import { formatUpdatedAt } from '../workspace-catalog';
import { ConfirmDialog } from './ConfirmDialog';

type HistoryFilter = 'all' | 'divination' | 'instant' | 'compatibility' | 'chat';

export type UnifiedHistoryItem =
  | {
      kind: 'divination' | 'instant';
      id: string;
      updatedAt: string;
      badgeText: string;
      title: string;
      subtitle?: string;
      rawDiv: DivinationRecord;
    }
  | {
      kind: 'compatibility';
      id: string;
      updatedAt: string;
      badgeText: string;
      title: string;
      subtitle?: string;
      rawCompat: CompatibilityRecord;
    }
  | {
      kind: 'chat';
      id: string;
      updatedAt: string;
      badgeText: string;
      title: string;
      subtitle?: string;
      rawChat: AgentChatSession;
    };

export interface SharedHistoryProps {
  divinationRecords: DivinationRecord[];
  compatibilityRecords: CompatibilityRecord[];
  agentSessions?: readonly AgentChatSession[];
  onSelectDivination: (rec: DivinationRecord) => void;
  onSelectCompatibility: (rec: CompatibilityRecord) => void;
  onSelectChatSession?: (session: AgentChatSession) => void;
  onDeleteRecord: (
    kind: 'divination' | 'instant' | 'compatibility' | 'chat',
    id: string,
  ) => void;
}

const FILTER_OPTIONS: ReadonlyArray<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'divination', label: '占卜' },
  { id: 'instant', label: '即时盘' },
  { id: 'compatibility', label: '合盘' },
  { id: 'chat', label: '对话' },
];

function useFilteredHistoryItems(
  divinationRecords: DivinationRecord[],
  compatibilityRecords: CompatibilityRecord[],
  agentSessions: readonly AgentChatSession[],
  filter: HistoryFilter,
  keyword: string,
): UnifiedHistoryItem[] {
  return React.useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const list: UnifiedHistoryItem[] = [];

    for (const r of divinationRecords) {
      const isInst = r.type === 'instant';
      const kind = isInst ? 'instant' : 'divination';
      if (filter !== 'all' && filter !== kind) continue;
      const cleanLabel = (
        r.methodLabel ||
        methodLabels[r.method as Method] ||
        r.method
      ).replace(/（预览）/g, '');
      const fullBadge = isInst ? `即时盘 · ${cleanLabel}` : `占卜 · ${cleanLabel}`;
      const shortBadge = fullBadge
        .replace(/^(占卜|即时盘|合盘)\s*·\s*/, '')
        .replace(/（基础预览）|（预览）/g, '')
        .replace('住宅风水', '阳宅风水');
      const title = r.question?.trim() || cleanLabel;
      const subtitle = isInst
        ? r.timeStandard === 'true-solar'
          ? '真太阳时起盘'
          : '北京时间起盘'
        : undefined;
      if (kw && !`${fullBadge} ${title} ${subtitle ?? ''}`.toLowerCase().includes(kw)) continue;
      list.push({
        kind,
        id: r.id,
        updatedAt: r.updatedAt,
        badgeText: shortBadge,
        title,
        subtitle,
        rawDiv: r,
      });
    }

    if (filter === 'all' || filter === 'compatibility') {
      for (const c of compatibilityRecords) {
        const cleanLabel = (
          methodLabels[c.method as Method] ??
          (c.method === 'ziwei-synastry'
            ? '紫微合盘'
            : c.method === 'astrolabe-synastry'
              ? '星盘合盘'
              : '八字合盘')
        ).replace(/（预览）/g, '');
        const p1Name = c.person1.name || c.primaryName || '命主一';
        const p2Name = c.person2.name || c.partnerName || '命主二';
        const title = `${p1Name} & ${p2Name}`;
        const subtitle =
          c.question?.trim() ||
          `${c.person1.year}-${c.person1.month}-${c.person1.day} × ${c.person2.year}-${c.person2.month}-${c.person2.day}`;
        if (kw && !`合盘 ${cleanLabel} ${title} ${subtitle}`.toLowerCase().includes(kw)) {
          continue;
        }
        list.push({
          kind: 'compatibility',
          id: c.id,
          updatedAt: c.updatedAt,
          badgeText: cleanLabel,
          title,
          subtitle,
          rawCompat: c,
        });
      }
    }

    if (filter === 'all' || filter === 'chat') {
      for (const s of agentSessions) {
        if (s.messages.length === 0) continue;
        const lastMsg = [...s.messages].reverse().find((m) => m.content.trim().length > 0);
        const title = s.title?.trim() || 'AI 对话';
        const snippet = lastMsg ? lastMsg.content.replace(/\s+/g, ' ').trim().slice(0, 42) : undefined;
        if (kw && !`对话 ${title} ${snippet ?? ''}`.toLowerCase().includes(kw)) continue;
        list.push({
          kind: 'chat',
          id: s.id,
          updatedAt: s.updatedAt,
          badgeText: '对话',
          title,
          subtitle: snippet,
          rawChat: s,
        });
      }
    }

    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return list;
  }, [divinationRecords, compatibilityRecords, agentSessions, filter, keyword]);
}

function HistoryListRows({
  items,
  compact = false,
  onSelect,
  onAskDelete,
}: {
  items: UnifiedHistoryItem[];
  compact?: boolean;
  onSelect: (item: UnifiedHistoryItem) => void;
  onAskDelete: (item: UnifiedHistoryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] text-center',
          compact ? 'flex-1 min-h-[220px] px-4 py-8' : 'px-6 py-12',
        )}
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--state-selected-surface)] font-serif text-lg font-bold text-[var(--accent-strong)]">
          史
        </span>
        <strong className="text-sm font-bold text-[var(--text-strong)]">暂无推演记录</strong>
        <p className="m-0 max-w-[260px] text-xs leading-relaxed text-[var(--text-muted)]">
          起卦、即时起盘或合盘后，记录会自动保存在这里
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <article
          key={`${item.kind}-${item.id}`}
          className="flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3.5 py-2.5 transition-colors hover:border-[var(--border-contrast)] hover:bg-[var(--surface-panel)]"
        >
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="flex min-w-0 flex-1 flex-col items-start gap-1 overflow-hidden border-0 bg-transparent p-0 text-left cursor-pointer"
          >
            <div className="flex w-full min-w-0 items-center gap-1.5">
              <Badge
                variant={
                  item.kind === 'compatibility' || item.kind === 'chat' ? 'accent' : 'outline'
                }
                className="shrink-0 px-2 py-0.5 text-[11px]"
              >
                {item.badgeText}
              </Badge>
              <strong className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--text-strong)]">
                {item.title}
              </strong>
            </div>
            <div className="flex w-full min-w-0 items-center gap-2 text-[11.5px] text-[var(--text-muted)]">
              {item.subtitle ? <span className="min-w-0 truncate">{item.subtitle}</span> : null}
              <time className="shrink-0 font-mono text-[11px]">
                {formatUpdatedAt(item.updatedAt)}
              </time>
            </div>
          </button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-[var(--danger-text)] hover:bg-[color-mix(in_srgb,var(--danger-text)_10%,transparent)]"
            title="删除记录"
            aria-label="删除记录"
            onClick={() => onAskDelete(item)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </article>
      ))}
    </div>
  );
}

/** 首页右侧常驻的独立历史记录卡片（固定在右侧留白区） */
export function HomeHistoryCard({
  className,
  divinationRecords,
  compatibilityRecords,
  agentSessions = [],
  onSelectDivination,
  onSelectCompatibility,
  onSelectChatSession,
  onDeleteRecord,
  onOpenFullPage,
}: SharedHistoryProps & {
  className?: string;
  onOpenFullPage: () => void;
}) {
  const [keyword, setKeyword] = React.useState('');
  const [filter, setFilter] = React.useState<HistoryFilter>('all');
  const [pendingDelete, setPendingDelete] = React.useState<UnifiedHistoryItem | null>(null);

  const items = useFilteredHistoryItems(
    divinationRecords,
    compatibilityRecords,
    agentSessions,
    filter,
    keyword,
  );

  return (
    <>
      <aside
        data-testid="home-history-card"
        aria-label="历史记录"
        className={cn(
          'flex flex-col overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] text-[var(--text-primary)] shadow-[0_2px_12px_rgba(32,24,16,0.035)]',
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border-soft)] px-4 py-3.5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[var(--accent-strong)]" aria-hidden="true" />
            <h2 className="m-0 font-sans text-[15px] font-extrabold text-[var(--text-strong)]">
              历史记录
            </h2>
          </div>

          <button
            type="button"
            onClick={onOpenFullPage}
            className="inline-flex items-center gap-0.5 rounded-lg border-0 bg-transparent px-1.5 py-1 text-[12px] font-semibold text-[var(--text-muted)] cursor-pointer hover:bg-[var(--surface-soft)] hover:text-[var(--accent-strong)]"
            title="打开完整历史记录页"
          >
            <span>全部</span>
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--border-soft)] px-3.5 py-3">
          <Input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索历史记录..."
          />

          <div
            className="flex flex-wrap items-center gap-1"
            role="tablist"
            aria-label="记录筛选"
          >
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(opt.id)}
                  className={cn(
                    'h-6.5 shrink-0 rounded-full border px-1.5 text-[10.5px] whitespace-nowrap cursor-pointer transition-colors',
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
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3.5">
          <HistoryListRows
            items={items}
            compact
            onSelect={(item) => {
              if (item.kind === 'compatibility') {
                onSelectCompatibility(item.rawCompat);
              } else if (item.kind === 'chat') {
                onSelectChatSession?.(item.rawChat);
              } else {
                onSelectDivination(item.rawDiv);
              }
            }}
            onAskDelete={setPendingDelete}
          />
        </div>
      </aside>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title="删除推演记录"
        message="删除后无法恢复，确定继续吗？"
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteRecord(pendingDelete.kind, pendingDelete.id);
          }
          setPendingDelete(null);
        }}
      />
    </>
  );
}

/** 顶栏点击后进入的独立历史记录页面（与全站 760px 居中风格一致） */
export function HistoryPage({
  divinationRecords,
  compatibilityRecords,
  agentSessions = [],
  onSelectDivination,
  onSelectCompatibility,
  onSelectChatSession,
  onDeleteRecord,
}: SharedHistoryProps) {
  const [keyword, setKeyword] = React.useState('');
  const [filter, setFilter] = React.useState<HistoryFilter>('all');
  const [pendingDelete, setPendingDelete] = React.useState<UnifiedHistoryItem | null>(null);

  const items = useFilteredHistoryItems(
    divinationRecords,
    compatibilityRecords,
    agentSessions,
    filter,
    keyword,
  );

  return (
    <div
      data-testid="history-page"
      className="mx-auto flex w-full min-w-0 max-w-[var(--workspace-canvas-form,760px)] flex-col gap-4 pb-10"
    >
      <PageHeader
        title="历史记录"
        rightSlot={
          <Badge variant="outline" className="hidden sm:inline-flex">
            共 {items.length} 条
          </Badge>
        }
      />

      <Card className="flex w-full min-w-0 flex-col gap-3 sm:gap-4 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5 sm:p-5 shadow-[0_2px_12px_rgba(32,24,16,0.035)]">
        <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="记录分类筛选"
          >
            {FILTER_OPTIONS.map((opt) => {
              const active = filter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(opt.id)}
                  className={cn(
                    'h-7.5 sm:h-8 shrink-0 rounded-full border px-2.5 sm:px-3.5 text-[11.5px] sm:text-xs whitespace-nowrap cursor-pointer transition-colors',
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

          <div className="flex items-center gap-2 min-w-0 sm:w-[240px]">
            <Input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索历史记录..."
              className="flex-1 min-w-0"
            />
            <span className="shrink-0 text-[12px] text-[var(--text-muted)] sm:hidden">
              {items.length} 条
            </span>
          </div>
        </div>

        <HistoryListRows
          items={items}
          onSelect={(item) => {
            if (item.kind === 'compatibility') {
              onSelectCompatibility(item.rawCompat);
            } else if (item.kind === 'chat') {
              onSelectChatSession?.(item.rawChat);
            } else {
              onSelectDivination(item.rawDiv);
            }
          }}
          onAskDelete={setPendingDelete}
        />
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title="删除推演记录"
        message="删除后无法恢复，确定继续吗？"
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteRecord(pendingDelete.kind, pendingDelete.id);
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
