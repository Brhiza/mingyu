import * as React from 'react';
import {
  ChevronRight,
  Dices,
  FolderOpen,
  LayoutGrid,
  Sun,
  User,
  Users,
} from 'lucide-react';
import type { PersonalCase } from '../../v2-ui/cases-store';
import type { HomeFortunePreview } from '../hooks/useHomeFortunePreview';
import { cn } from '../../lib/utils';
import { AgentChatPanel, type AgentChatPanelProps } from './AgentChatPanel';

export interface HomeFortuneBarProps {
  homeFortune?: HomeFortunePreview | null;
  activeCase?: PersonalCase | null;
  variant?: 'desktop' | 'mobile';
  onPreload?: () => void;
  onClick: () => void;
}

export function HomeFortuneBar({
  homeFortune = null,
  activeCase = null,
  variant = 'desktop',
  onPreload,
  onClick,
}: HomeFortuneBarProps) {
  const isPersonalized = Boolean(
    activeCase && (activeCase.reverseSource || (activeCase.year && activeCase.month && activeCase.day)),
  );
  const titleLabel = homeFortune?.label ?? (isPersonalized ? '个人日运' : '今日运势');
  const calendarMeta = [homeFortune?.lunarDate, homeFortune?.solarTerm].filter(Boolean).join(' · ');
  const headlineText = homeFortune?.headline || '查看今日运势';

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onPointerEnter={onPreload}
        onPointerDown={onPreload}
        onClick={onClick}
        className="mobile-home-fortune-strip"
        aria-label={`查看${titleLabel}`}
      >
        <span className="mobile-home-fortune-mark" aria-hidden="true">
          <Sun className="h-4 w-4" />
        </span>
        <span className="mobile-home-fortune-copy">
          <small>
            {titleLabel}
            {calendarMeta ? ` · ${calendarMeta}` : ''}
          </small>
          <strong>{headlineText}</strong>
        </span>
        {homeFortune ? (
          <span className="mobile-home-fortune-trailing">
            <span
              className="mobile-home-fortune-color"
              style={{ backgroundColor: homeFortune.luckyColorHex }}
              title={homeFortune.luckyColorName ? `今日开运色：${homeFortune.luckyColorName}` : '今日开运色'}
              aria-hidden="true"
            />
            <span className="mobile-home-fortune-tier">
              {homeFortune.tier} · {homeFortune.score}分
            </span>
          </span>
        ) : null}
        <ChevronRight className="mobile-home-fortune-arrow h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onPointerEnter={onPreload}
      onPointerDown={onPreload}
      onClick={onClick}
      className="home-desktop-fortune-bar group flex min-h-[48px] w-full min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-2xl border border-[var(--border-soft)] px-4 py-2.5 text-left cursor-pointer transition-all hover:border-[var(--accent)]"
      aria-label={`查看${titleLabel}`}
    >
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
        <Sun className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <strong className="text-[13px] font-extrabold text-[var(--accent-strong)]">
          {titleLabel}
        </strong>
        {calendarMeta ? (
          <span className="text-[12px] font-medium text-[var(--text-muted)]">
            {`· ${calendarMeta}`}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-[var(--text-primary)]">
        {headlineText}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {homeFortune ? (
          <>
            <span
              className="size-3 rounded-full border border-[var(--surface-elevated-strong)] shadow-[0_0_0_1px_var(--border-soft)]"
              style={{ backgroundColor: homeFortune.luckyColorHex }}
              title={homeFortune.luckyColorName ? `今日开运色：${homeFortune.luckyColorName}` : '今日开运色'}
              aria-hidden="true"
            />
            <span className="rounded-full border border-[color-mix(in_srgb,var(--accent)_28%,var(--border-soft))] bg-[var(--accent-soft)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--accent-strong)] tabular-nums">
              {homeFortune.tier} · {homeFortune.score}分
            </span>
          </>
        ) : null}
        <ChevronRight
          className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)]"
          aria-hidden="true"
        />
      </span>
    </button>
  );
}

export interface HomePageProps {
  caseCount: number;
  activeCase?: PersonalCase | null;
  homeFortune?: HomeFortunePreview | null;
  homeVisitRevision?: number;
  agentChat?: Omit<AgentChatPanelProps, 'variant'>;
  onOpenChartInput: (mode: 'single' | 'compat') => void;
  onOpenCasesDrawer: () => void;
  onOpenCustomShortcutTarget: (shortcutId: string) => void;
}

export function HomePage({
  caseCount,
  activeCase = null,
  homeFortune = null,
  homeVisitRevision = 0,
  agentChat,
  onOpenChartInput,
  onOpenCasesDrawer,
  onOpenCustomShortcutTarget,
}: HomePageProps) {
  const hasChatMessages = Boolean(agentChat?.onlineAiActive && agentChat.session.messages.length);

  return (
    <div
      className={cn(
        'workspace-home-page mx-auto w-full max-w-[var(--ws-canvas,1120px)] min-w-0 py-0.5 min-[680px]:py-0 min-[680px]:pb-0',
        hasChatMessages
          ? 'pb-40 min-[680px]:flex min-[680px]:min-h-0 min-[680px]:flex-1 min-[680px]:flex-col min-[680px]:py-0 min-[680px]:pb-0'
          : 'pb-0',
      )}
    >
      <div
        className={cn(
          'mx-auto grid w-full min-w-0 max-w-[var(--ws-canvas,1120px)] grid-cols-1 gap-3 min-[680px]:gap-4',
          hasChatMessages && 'min-[680px]:flex min-[680px]:min-h-0 min-[680px]:flex-1 min-[680px]:flex-col',
          !hasChatMessages && 'pt-3 pb-[184px] min-[680px]:pt-0 min-[680px]:pb-0',
        )}
      >
        {/* 1. 智能路由主输入框（保持首屏第一主角，支持 AI 多轮或端侧直达排盘） */}
        {agentChat ? (
          <AgentChatPanel
            variant="home-hero"
            focusKey={homeVisitRevision}
            {...agentChat}
          />
        ) : null}

        {/* 2. 桌面端：今日运势轻通栏 + 4 张核心场景大卡（去杂货铺留白重做） */}
        {!hasChatMessages ? (
          <div className="hidden min-w-0 grid-cols-1 gap-3 min-[680px]:grid" data-testid="desktop-home-core">
            <HomeFortuneBar
              variant="desktop"
              homeFortune={homeFortune}
              activeCase={activeCase}
              onClick={() => onOpenCustomShortcutTarget('fortune')}
            />

            <div className="grid grid-cols-2 gap-2.5 min-[960px]:grid-cols-4" aria-label="核心工作台入口">
              <button
                type="button"
                onClick={() => onOpenChartInput('single')}
                className="group flex min-h-[56px] items-center justify-between gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-4 py-3 text-left transition-all cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <strong className="truncate text-[13.5px] font-extrabold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                    单人排盘
                  </strong>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={() => onOpenChartInput('compat')}
                className="group flex min-h-[56px] items-center justify-between gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-4 py-3 text-left transition-all cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--accent-strong)]">
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <strong className="truncate text-[13.5px] font-extrabold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                    双人合盘
                  </strong>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={() => onOpenCustomShortcutTarget('liuyao')}
                className="group flex min-h-[56px] items-center justify-between gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-4 py-3 text-left transition-all cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--accent-strong)]">
                    <Dices className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <strong className="truncate text-[13.5px] font-extrabold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                    占卜起卦
                  </strong>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={() => onOpenCustomShortcutTarget('tools')}
                className="group flex min-h-[56px] items-center justify-between gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-4 py-3 text-left transition-all cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--accent-strong)]">
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <strong className="truncate text-[13.5px] font-extrabold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                    工具箱
                  </strong>
                </span>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        ) : null}

        {/* 3. 移动端：3 枚与底栏零重复的高频入口 */}
        {!hasChatMessages ? (
          <div
            className="flex flex-col items-center px-2 min-[680px]:hidden"
            data-testid="mobile-home-shortcuts"
          >
            <div className="grid w-full max-w-[360px] grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onOpenChartInput('compat')}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2 text-[12.5px] font-bold text-[var(--text-strong)] shadow-xs cursor-pointer transition-transform active:scale-[0.98]"
              >
                <Users className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
                <span className="truncate">双人合盘</span>
              </button>
              <button
                type="button"
                onClick={onOpenCasesDrawer}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2 text-[12.5px] font-bold text-[var(--text-strong)] shadow-xs cursor-pointer transition-transform active:scale-[0.98]"
              >
                <FolderOpen
                  className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]"
                  aria-hidden="true"
                />
                <span className="truncate">档案{caseCount > 0 ? `(${caseCount})` : ''}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenCustomShortcutTarget('tools')}
                className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2 text-[12.5px] font-bold text-[var(--text-strong)] shadow-xs cursor-pointer transition-transform active:scale-[0.98]"
              >
                <LayoutGrid
                  className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]"
                  aria-hidden="true"
                />
                <span className="truncate">工具箱</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
