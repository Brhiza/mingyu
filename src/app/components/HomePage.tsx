import * as React from 'react';
import {
  ArrowUpRight,
  BookA,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  FolderOpen,
  Hash,
  Home as HomeIcon,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import type { PersonalCase } from '../../v2-ui/cases-store';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import {
  CUSTOM_SHORTCUT_CATALOG,
  HOME_CHART_ENTRY_CATALOG,
  HOME_INSTANT_CAST_CATALOG,
  isHomeCustomizationModified,
  type HomeCustomizationState,
} from '../workspace-catalog';
import { AgentChatPanel, type AgentChatPanelProps } from './AgentChatPanel';
import { LocalAgentBar, type LocalAgentApplyPayload } from './LocalAgentBar';

export interface HomePageProps {
  homeInstantTimeStandard: 'beijing' | 'true-solar';
  homeInstantPlace: { displayName: string; longitude: number; latitude: number };
  homeCustomization: HomeCustomizationState;
  caseCount: number;
  cases?: readonly PersonalCase[];
  attachedCaseId?: string | null;
  onSelectAttachedCase?: (caseId: string | null) => void;
  birthPlaceModal: BirthPlaceModalController;
  chatModeActive?: boolean;
  homeVisitRevision?: number;
  agentChat?: Omit<AgentChatPanelProps, 'variant'>;
  onToggleTimeStandard: () => void;
  onUpdateInstantPlace: (place: {
    displayName: string;
    longitude: number;
    latitude: number;
  }) => void;
  onOneClickInstantCast: (itemId: string) => void;
  onOpenChartInput: (mode: 'single' | 'compat') => void;
  onOpenCasesDrawer: () => void;
  onOpenCustomShortcutTarget: (shortcutId: string) => void;
  onToggleHomeItem: (section: keyof HomeCustomizationState, id: string) => void;
  onResetHomeCustomization: () => void;
  onApplyLocalAgentRecommendation?: (payload: LocalAgentApplyPayload) => void | Promise<void>;
}

type HomePickerMode = 'instantCast' | 'chart' | 'cards' | null;

const NICHE_CARD_MARKS: Record<string, string> = {
  taiyi: '乙',
  'huangji-jingshi': '皇',
  'wuyun-liuqi': '运',
  zhuge: '诸',
};

const ACCENT_SOFT_CARD_IDS = new Set([
  'fortune',
  'almanac',
  'calendar',
  'residential',
  'name-char',
  'zhouyi',
  'number-energy',
  'taiyi',
  'huangji-jingshi',
  'wuyun-liuqi',
  'zhuge',
]);

function getShortcutIcon(id: string): React.ComponentType<{ className?: string }> {
  if (id === 'compatibility' || id === 'compat') return Users;
  if (id === 'cases') return FolderOpen;
  if (id === 'history') return Clock;
  if (id === 'connect') return Bot;
  if (id === 'almanac' || id === 'calendar' || id === 'fortune') return CalendarDays;
  if (id === 'residential') return HomeIcon;
  if (
    id === 'name-char' ||
    id === 'chinese-name' ||
    id === 'chinese-naming' ||
    id === 'character-query' ||
    id === 'zhouyi'
  ) {
    return BookA;
  }
  if (id === 'number-energy') return Hash;
  if (
    id === 'bazi' ||
    id === 'ziwei' ||
    id === 'bazi-ziwei' ||
    id === 'astrolabe' ||
    id === 'qizheng' ||
    id === 'qimen-lifetime' ||
    id === 'birth-range'
  ) {
    return Compass;
  }
  return Sparkles;
}

const CORE_DIALOG_DIVINATION_IDS = new Set([
  'liuyao',
  'meihua',
  'qimen',
  'liuren',
  'tarot',
]);

const HOME_TOOLS_EXPANDED_KEY = 'mingyu.v2.home.showTools';

export function HomePage({
  homeInstantTimeStandard,
  homeInstantPlace,
  homeCustomization,
  caseCount,
  cases = [],
  attachedCaseId = null,
  onSelectAttachedCase,
  birthPlaceModal,
  chatModeActive = false,
  homeVisitRevision = 0,
  agentChat,
  onToggleTimeStandard,
  onUpdateInstantPlace,
  onOneClickInstantCast,
  onOpenChartInput,
  onOpenCasesDrawer,
  onOpenCustomShortcutTarget,
  onToggleHomeItem,
  onResetHomeCustomization,
  onApplyLocalAgentRecommendation,
}: HomePageProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [pickerMode, setPickerMode] = React.useState<HomePickerMode>(null);
  const [showAllTraditionalTools, setShowAllTraditionalTools] = React.useState<boolean>(() => {
    try {
      return window.localStorage.getItem(HOME_TOOLS_EXPANDED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleTraditionalTools = React.useCallback(() => {
    setShowAllTraditionalTools((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(HOME_TOOLS_EXPANDED_KEY, next ? 'true' : 'false');
      } catch {}
      return next;
    });
  }, []);

  React.useEffect(() => {
    setIsEditing(false);
    setPickerMode(null);
  }, [homeVisitRevision]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
  const clockStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const isModified = React.useMemo(
    () => isHomeCustomizationModified(homeCustomization),
    [homeCustomization],
  );

  const visibleInstantCastItems = React.useMemo(
    () =>
      homeCustomization.instantCastIds
        .map((id) => HOME_INSTANT_CAST_CATALOG.find((item) => item.id === id))
        .filter((item): item is (typeof HOME_INSTANT_CAST_CATALOG)[number] => Boolean(item)),
    [homeCustomization.instantCastIds],
  );

  const visibleChartEntries = React.useMemo(
    () =>
      homeCustomization.chartEntryIds
        .map((id) => HOME_CHART_ENTRY_CATALOG.find((item) => item.id === id))
        .filter((item): item is (typeof HOME_CHART_ENTRY_CATALOG)[number] => Boolean(item)),
    [homeCustomization.chartEntryIds],
  );

  const visibleHomeCards = React.useMemo(
    () =>
      homeCustomization.cardIds
        .map((id) => CUSTOM_SHORTCUT_CATALOG.find((item) => item.id === id))
        .filter((item): item is (typeof CUSTOM_SHORTCUT_CATALOG)[number] => Boolean(item)),
    [homeCustomization.cardIds],
  );

  const handleChartEntryClick = (entryId: string) => {
    if (entryId === 'single') {
      onOpenChartInput('single');
      return;
    }
    if (entryId === 'compat') {
      onOpenChartInput('compat');
      return;
    }
    if (entryId === 'cases') {
      onOpenCasesDrawer();
      return;
    }
    onOpenCustomShortcutTarget(entryId);
  };

  const pickerGroups = React.useMemo(() => {
    if (pickerMode === 'instantCast') {
      return (['常用占卜', '宏观周期'] as const).map((group) => ({
        title: group,
        section: 'instantCastIds' as const,
        selectedIds: homeCustomization.instantCastIds,
        options: HOME_INSTANT_CAST_CATALOG.filter((o) => o.group === group),
      }));
    }
    if (pickerMode === 'chart') {
      return [
        {
          title: '命盘入口',
          section: 'chartEntryIds' as const,
          selectedIds: homeCustomization.chartEntryIds,
          options: HOME_CHART_ENTRY_CATALOG,
        },
      ];
    }
    if (pickerMode === 'cards') {
      return (['命盘', '占卜', '工具'] as const).map((group) => ({
        title: group,
        section: 'cardIds' as const,
        selectedIds: homeCustomization.cardIds,
        options: CUSTOM_SHORTCUT_CATALOG.filter((o) => o.group === group),
      }));
    }
    return [];
  }, [pickerMode, homeCustomization]);

  const pickerMeta =
    pickerMode === 'instantCast'
      ? {
          title: '编辑即时起卦',
          ariaLabel: '编辑即时起卦图标',
        }
      : pickerMode === 'chart'
        ? {
            title: '编辑命盘入口',
            ariaLabel: '编辑命盘排盘图标',
          }
        : {
            title: '添加快捷卡片',
            ariaLabel: '添加主页快捷卡片',
          };

  const editControls = isEditing ? (
    <div className="flex items-center gap-2">
      {isModified ? (
        <Button
          variant="outline"
          size="xs"
          onClick={onResetHomeCustomization}
          className="h-7.5 rounded-full px-2.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>恢复默认</span>
        </Button>
      ) : null}
      <Button
        variant="primary"
        size="xs"
        onClick={() => setIsEditing(false)}
        className="h-7.5 rounded-full px-3 text-xs"
      >
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        <span>完成</span>
      </Button>
    </div>
  ) : (
    <Button
      variant="outline"
      size="icon"
      aria-label="编辑首页"
      title="编辑首页"
      onClick={() => setIsEditing(true)}
      className="h-8 w-8 rounded-full border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  );

  const showDialogHome = Boolean(chatModeActive && agentChat);
  const hasChatMessages = Boolean(showDialogHome && agentChat?.session.messages.length);
  const coreQuickDivinationItems = visibleInstantCastItems.filter((item) =>
    CORE_DIALOG_DIVINATION_IDS.has(item.id),
  );
  const coreQuickChartEntries = visibleChartEntries.filter(
    (entry) => entry.id === 'single' || entry.id === 'compat',
  );

  return (
    <div className="workspace-home-page w-full min-w-0 py-0.5 pb-36 min-[680px]:py-1 min-[680px]:pb-10">
      <div className="mx-auto grid w-full max-w-[var(--ws-canvas,1120px)] gap-2.5 min-[680px]:gap-3.5">
        {/* 1. 统一居中主输入框（已接入在线 AI 走多轮对话，未接入走本地端侧小模型直达排盘） */}
        {showDialogHome && agentChat ? (
          <AgentChatPanel variant="home-hero" {...agentChat} />
        ) : onApplyLocalAgentRecommendation ? (
          <LocalAgentBar
            cases={cases}
            attachedCaseId={attachedCaseId}
            onSelectAttachedCase={onSelectAttachedCase}
            onApplyRecommendation={onApplyLocalAgentRecommendation}
          />
        ) : null}

        {/* 2. 精简核心快捷入口（其余低频功能点「更多工具」展开） */}
        {!hasChatMessages || showAllTraditionalTools ? (
          <div
            aria-label="常用快捷入口"
            className="mx-auto flex w-full max-w-[780px] flex-wrap items-center justify-center gap-1.5 px-1"
          >
            {coreQuickChartEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => handleChartEntryClick(entry.id)}
                className="inline-flex h-7.5 shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--text-strong)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)] hover:text-[var(--accent-strong)]"
              >
                <span>{entry.label}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => onOpenCustomShortcutTarget('fortune')}
              className="inline-flex h-7.5 shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--text-strong)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)] hover:text-[var(--accent-strong)]"
            >
              <span>日/月/年运势</span>
            </button>
            {coreQuickDivinationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOneClickInstantCast(item.id)}
                className="inline-flex h-7.5 shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--text-strong)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)] hover:text-[var(--accent-strong)]"
              >
                <span>{item.label}</span>
              </button>
            ))}
            <button
              type="button"
              aria-expanded={showAllTraditionalTools}
              onClick={toggleTraditionalTools}
              className="inline-flex h-7.5 shrink-0 whitespace-nowrap items-center gap-1 rounded-full border border-dashed border-[var(--border-contrast)] bg-transparent px-3 text-[12px] font-semibold text-[var(--text-muted)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              <span>{showAllTraditionalTools ? '收起工具' : '更多工具'}</span>
              {showAllTraditionalTools ? (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        ) : null}

        {/* 3. 按需展开完整传统排盘与快捷工具 */}
            {showAllTraditionalTools ? (
              <section aria-label="传统排盘与快捷工具" className="grid gap-2.5 pt-1">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="m-0 text-xs font-extrabold tracking-wide text-[var(--text-muted)]">
                      传统排盘与快捷工具
                    </h2>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                      {dateStr} · {clockStr}
                    </span>
                  </div>
                  {editControls}
                </div>

                {/* 紧凑双栏：左即时起卦 · 右命盘排盘 */}
              <div className="grid grid-cols-1 gap-2.5 min-[680px]:grid-cols-12">
                {/* 紧凑即时起卦 */}
                <Card
                  className={cn(
                    'flex flex-col justify-start gap-2 rounded-xl border bg-[var(--surface-elevated-strong)] p-3 shadow-xs min-[680px]:col-span-6',
                    isEditing
                      ? 'border-dashed border-[color-mix(in_srgb,var(--accent)_55%,var(--border-soft))]'
                      : 'border-[var(--border-soft)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex size-5.5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-strong)] font-serif text-[11px] font-bold text-white">
                        卦
                      </span>
                      <strong className="text-[13px] font-extrabold text-[var(--text-strong)]">
                        即时起卦
                      </strong>
                    </div>
                    <Button
                      variant="secondary"
                      size="xs"
                      className="h-6.5 px-2 text-[11px] tabular-nums"
                      onClick={onToggleTimeStandard}
                    >
                      {homeInstantTimeStandard === 'true-solar' ? '真太阳时' : '北京时间'}
                    </Button>
                  </div>

                  {homeInstantTimeStandard === 'true-solar' ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-1 text-[11px]">
                      <span className="text-[var(--text-muted)]">参考地</span>
                      <button
                        type="button"
                        onClick={() => {
                          birthPlaceModal.open({
                            purpose: 'observer',
                            initialPlace: homeInstantPlace.displayName,
                            onConfirm: (sel) => {
                              onUpdateInstantPlace({
                                displayName: sel.displayName,
                                longitude: sel.longitude,
                                latitude: sel.latitude,
                              });
                            },
                          });
                        }}
                        className="truncate border-0 bg-transparent p-0 font-semibold text-[var(--accent-strong)] cursor-pointer hover:underline"
                      >
                        {homeInstantPlace.displayName} · 更换
                      </button>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {visibleInstantCastItems.map((item) =>
                      isEditing ? (
                        <div
                          key={item.id}
                          className="flex h-8 items-center justify-between gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2"
                        >
                          <span className="truncate text-[11.5px] font-bold text-[var(--text-strong)]">
                            {item.label}
                          </span>
                          <button
                            type="button"
                            aria-label={`移除即时起卦 ${item.label}`}
                            onClick={() => onToggleHomeItem('instantCastIds', item.id)}
                            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border-0 bg-[var(--surface-elevated)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--danger-text)] hover:text-white"
                          >
                            <X className="h-2.5 w-2.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onOneClickInstantCast(item.id)}
                          className="group flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-2 text-left transition-colors cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]"
                        >
                          <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded bg-[var(--surface-soft)] font-serif text-[10px] font-bold text-[var(--text-muted)] group-hover:text-[var(--accent-strong)]">
                            {item.mark}
                          </span>
                          <span className="truncate text-[11.5px] font-bold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                            {item.label}
                          </span>
                        </button>
                      ),
                    )}

                    {isEditing ? (
                      <button
                        type="button"
                        aria-label="添加即时起卦图标"
                        onClick={() => setPickerMode('instantCast')}
                        className="flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/55 px-2 text-[11px] font-semibold text-[var(--text-muted)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>添加</span>
                      </button>
                    ) : null}
                  </div>
                </Card>

                {/* 紧凑命盘排盘 */}
                <Card
                  aria-label="命盘排盘与档案"
                  className={cn(
                    'flex flex-col justify-between gap-2 rounded-xl border bg-[var(--surface-elevated-strong)] p-3 shadow-xs min-[680px]:col-span-6',
                    isEditing
                      ? 'border-dashed border-[color-mix(in_srgb,var(--accent)_55%,var(--border-soft))]'
                      : 'border-[var(--border-soft)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex size-5.5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-strong)] font-serif text-[11px] font-bold text-white">
                        盘
                      </span>
                      <strong className="text-[13px] font-extrabold text-[var(--text-strong)]">
                        命盘排盘
                      </strong>
                    </div>
                    <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--text-muted)]">
                      {caseCount > 0 ? `${caseCount} 份档案` : '八字 · 紫微 · 星盘'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {visibleChartEntries.map((entry) => {
                      const Icon = getShortcutIcon(entry.id);
                      const isPrimary = entry.id === 'single';
                      return isEditing ? (
                        <div
                          key={entry.id}
                          className="flex h-9 items-center justify-between gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2"
                        >
                          <span className="truncate text-[11.5px] font-bold text-[var(--text-strong)]">
                            {entry.label}
                          </span>
                          <button
                            type="button"
                            aria-label={`移除 ${entry.label}`}
                            onClick={() => onToggleHomeItem('chartEntryIds', entry.id)}
                            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border-0 bg-[var(--surface-elevated)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--danger-text)] hover:text-white"
                          >
                            <X className="h-2.5 w-2.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => handleChartEntryClick(entry.id)}
                          className={cn(
                            'group flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-left transition-colors cursor-pointer',
                            isPrimary
                              ? 'border-[color-mix(in_srgb,var(--accent)_35%,var(--border-soft))] bg-[var(--state-selected-surface)] text-[var(--state-selected-text)] hover:border-[var(--accent)]'
                              : 'border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-strong)] hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]',
                          )}
                        >
                          {isPrimary ? (
                            <User className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                          ) : (
                            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                          )}
                          <span className="truncate text-[12px] font-bold">{entry.label}</span>
                        </button>
                      );
                    })}

                    {isEditing ? (
                      <button
                        type="button"
                        aria-label="添加命盘排盘入口"
                        onClick={() => setPickerMode('chart')}
                        className="flex h-9 items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/55 px-2 text-[11px] font-semibold text-[var(--text-muted)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>添加</span>
                      </button>
                    ) : null}
                  </div>
                </Card>
              </div>

              {/* 紧凑快捷功能条 */}
              <div
                aria-label="首页快捷功能"
                className="grid grid-cols-3 gap-1.5 min-[680px]:grid-cols-4 lg:grid-cols-6 min-[680px]:gap-2"
              >
                {visibleHomeCards.map((card) => {
                  const nicheMark = NICHE_CARD_MARKS[card.id];
                  const Icon = getShortcutIcon(card.id);
                  const useAccentSoft = ACCENT_SOFT_CARD_IDS.has(card.id);
                  const iconBadge = (
                    <span
                      className={cn(
                        'inline-flex size-6.5 shrink-0 items-center justify-center rounded-lg text-[var(--accent-strong)]',
                        useAccentSoft ? 'bg-[var(--accent-soft)]' : 'bg-[var(--surface-soft)]',
                        nicheMark && 'font-serif text-xs font-bold',
                      )}
                    >
                      {nicheMark ?? <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                  );

                  if (isEditing) {
                    return (
                      <div
                        key={card.id}
                        className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--accent)_45%,var(--border-soft))] bg-[var(--surface-elevated-strong)] px-2.5 py-1.5"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {iconBadge}
                          <strong className="truncate text-[12px] font-bold text-[var(--text-strong)]">
                            {card.label}
                          </strong>
                        </span>
                        <button
                          type="button"
                          aria-label={`移除快捷卡片 ${card.label}`}
                          onClick={() => onToggleHomeItem('cardIds', card.id)}
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-[var(--surface-soft)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--danger-text)] hover:text-white"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onOpenCustomShortcutTarget(card.id)}
                      className="group flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2.5 py-1.5 text-left transition-all cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--surface-panel)]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {iconBadge}
                        <strong className="truncate text-[12px] font-bold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                          {card.label}
                        </strong>
                      </span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-50 group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPickerMode('cards')}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/45 px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-muted)] opacity-80 transition-all cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent-strong)] hover:opacity-100"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>添加卡片</span>
                </button>
              </div>
            </section>
            ) : null}
      </div>

      {/* 首页图标与卡片编辑弹窗 */}
      <Dialog
        open={pickerMode !== null}
        onOpenChange={(open) => {
          if (!open) setPickerMode(null);
        }}
      >
        <DialogContent className="max-w-lg" aria-label={pickerMeta.ariaLabel}>
          <DialogHeader>
            <DialogTitle>{pickerMeta.title}</DialogTitle>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-4">
            {pickerGroups.map((group) => (
              <div key={group.title} className="grid gap-2">
                <span className="text-xs font-extrabold text-[var(--text-muted)]">
                  {group.title}
                </span>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((opt) => {
                    const added = group.selectedIds.includes(opt.id);
                    return (
                      <Button
                        key={opt.id}
                        variant={added ? 'pillActive' : 'pill'}
                        size="sm"
                        onClick={() => onToggleHomeItem(group.section, opt.id)}
                      >
                        {added ? `✓ ${opt.label}` : `+ ${opt.label}`}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="primary" size="md" onClick={() => setPickerMode(null)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
